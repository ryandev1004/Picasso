import { app, BrowserWindow, globalShortcut, ipcMain } from "electron";
import {
  IPC,
  type AgentResponse,
  type AppInfo,
  type DrawResult,
  type RedrawRequest,
} from "@shared/ipc";
import { displayHotkey, PANEL_HOTKEY } from "./system/shortcuts";
import { hidePanel, togglePanel } from "./windows/panelWindow";
import { clearApiKey, hasApiKey, saveApiKey } from "./storage/settings";
import { generateDiagram, redrawDiagram } from "./agent/response";
import { copyDiagramToClipboard } from "./paste/clipboard";
import { pasteIntoTarget } from "./paste/pasteTarget";
import {
  addVersion,
  deleteDrawing,
  getDrawing,
  isDrawingId,
  listDrawings,
  markInserted,
  type NewVersion,
} from "./storage/history";

const MAX_PROMPT_LENGTH = 1000;
// A diagram is a few thousand characters, so this leaves lots of room.
const MAX_SVG_LENGTH = 100_000;
// The diagram plus hand-drawn marks (long pen strokes add path data).
const MAX_MARKED_SVG_LENGTH = 300_000;
// A ~1000px picture of a diagram is well under 1 MB.
const MAX_MARKS_PNG_BYTES = 8 * 1024 * 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Whether `value` is PNG bytes of a sensible size (checked by the PNG file signature). */
function isPng(value: unknown): value is Uint8Array {
  return (
    value instanceof Uint8Array &&
    value.byteLength > PNG_SIGNATURE.length &&
    value.byteLength <= MAX_MARKS_PNG_BYTES &&
    PNG_SIGNATURE.every((byte, i) => value[i] === byte)
  );
}

/**
 * Everything the Vue windows can ask the main process to do.
 * `handle` = request/response (renderer awaits a result). `on` = fire-and-forget.
 */
export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.getAppInfo, (): AppInfo => ({
    version: app.getVersion(),
    hotkey: displayHotkey(PANEL_HOTKEY),
    hotkeyActive: globalShortcut.isRegistered(PANEL_HOTKEY),
  }));

  ipcMain.on(IPC.togglePanel, () => togglePanel());
  ipcMain.on(IPC.hidePanel, () => hidePanel());

  ipcMain.handle(IPC.hasApiKey, () => hasApiKey());
  ipcMain.handle(IPC.saveApiKey, (_event, key: unknown) => saveApiKey(key));
  ipcMain.handle(IPC.clearApiKey, () => clearApiKey());
  ipcMain.handle(
    IPC.generateDiagram,
    async (_event, prompt: unknown, drawingId: unknown) => {
      if (typeof prompt !== "string") {
        return { ok: false, error: "Invalid prompt" };
      } else {
        const input = prompt.trim();
        if (input === "") {
          return { ok: false, error: "Type what you want drawn first." };
        }
        if (input.length > MAX_PROMPT_LENGTH) {
          return {
            ok: false,
            error: "That’s too long. Try a shorter description.",
          };
        }
        // With a drawing id this is an empty Redraw, so the new version joins that drawing.
        return saveDrawn(await generateDiagram(input), {
          drawingId,
          description: input,
          kind: "retry",
        });
      }
    },
  );
  ipcMain.handle(IPC.redrawDiagram, async (_event, request: unknown) => {
    const checked = checkRedraw(request);
    if (typeof checked === "string") return { ok: false, error: checked };
    return saveDrawn(await redrawDiagram(checked), {
      drawingId: checked.drawingId,
      description: checked.description,
      kind: "edit",
      change: checked.change,
      marksSvg: checked.marks?.svg,
    });
  });
  ipcMain.handle(
    IPC.approveDiagram,
    async (_event, png: unknown, drawingId: unknown, version: unknown) => {
      const result = await copyDiagramToClipboard(png);
      if (!result.ok) return result;

      // Switches back to the window the panel was opened from, hides the panel, and pastes
      // there. When it can't (Notepad, the window closed…), the diagram is still on the
      // clipboard for Ctrl+V.
      await pasteIntoTarget(hidePanel);
      if (isDrawingId(drawingId) && Number.isInteger(version)) {
        try {
          await markInserted(drawingId, version as number);
          notifyDrawingsChanged();
        } catch (error) {
          console.error("[picasso] couldn't mark the drawing inserted:", error);
        }
      }
      return result;
    },
  );
  ipcMain.handle(IPC.copyImage, (_event, png: unknown) =>
    copyDiagramToClipboard(png),
  );

  ipcMain.handle(IPC.listDrawings, () => listDrawings());
  ipcMain.handle(IPC.getDrawing, (_event, id: unknown) =>
    isDrawingId(id) ? getDrawing(id) : null,
  );
  ipcMain.handle(IPC.deleteDrawing, async (_event, id: unknown) => {
    if (!isDrawingId(id)) return;
    await deleteDrawing(id);
    notifyDrawingsChanged();
  });
}

/** Saves a successful drawing to history and tells the windows. Failures pass straight through. */
async function saveDrawn(
  result: AgentResponse,
  details: Omit<NewVersion, "svg">,
): Promise<DrawResult> {
  if (!result.ok) return result;
  const saved = await addVersion({ ...details, svg: result.svg });
  notifyDrawingsChanged();
  return { ok: true, svg: result.svg, ...saved };
}

/** Tells every open window that the drawings changed, so their lists can reload. */
function notifyDrawingsChanged(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.webContents.send(IPC.drawingsChanged);
  }
}

/**
 * Checks a Redraw request from the panel before it reaches Claude (anything can arrive over IPC).
 * Returns the cleaned-up request, or an error message to show the user.
 */
function checkRedraw(request: unknown): RedrawRequest | string {
  if (typeof request !== "object" || request === null) {
    return "Invalid redraw request";
  }
  const { description, svg, change, drawingId, marks } = request as Record<
    string,
    unknown
  >;
  if (
    typeof description !== "string" ||
    typeof svg !== "string" ||
    typeof change !== "string"
  ) {
    return "Invalid redraw request";
  }

  const cleanDescription = description.trim();
  const cleanChange = change.trim();
  if (cleanChange === "") return "Type what should change first.";
  if (
    cleanDescription.length > MAX_PROMPT_LENGTH ||
    cleanChange.length > MAX_PROMPT_LENGTH
  ) {
    return "That’s too long. Try a shorter description.";
  }
  if (!svg.trimStart().startsWith("<svg") || svg.length > MAX_SVG_LENGTH) {
    return "The current diagram couldn't be sent. Try a fresh drawing.";
  }

  // Marks are optional: the diagram with marks on top as SVG (for history) and as a PNG (for Claude).
  let checkedMarks: RedrawRequest["marks"];
  if (marks !== undefined && marks !== null) {
    const { svg: marksSvg, png } = marks as Record<string, unknown>;
    if (
      typeof marksSvg !== "string" ||
      !marksSvg.trimStart().startsWith("<svg") ||
      marksSvg.length > MAX_MARKED_SVG_LENGTH ||
      !isPng(png)
    ) {
      return "Your marks couldn't be sent. Try drawing them again.";
    }
    checkedMarks = { svg: marksSvg, png };
  }

  return {
    marks: checkedMarks,
    description: cleanDescription,
    svg,
    change: cleanChange,
    drawingId: isDrawingId(drawingId) ? drawingId : undefined,
  };
}
