import { app, BrowserWindow, ipcMain } from "electron";
import { IPC, type AppInfo, type DrawResult } from "@shared/ipc";
import { hotkeyInfo } from "./system/shortcuts";
import { hidePanel, togglePanel } from "./windows/panelWindow";
import { clearApiKey, hasApiKey, saveApiKey } from "./storage/settings";
import {
  generateDiagram,
  redrawDiagram,
  type AgentResponse,
} from "./agent/response";
import { copyDiagramToClipboard } from "./paste/clipboard";
import { pasteIntoTarget } from "./paste/pasteTarget";
import {
  addVersion,
  deleteDrawing,
  getDrawing,
  listDrawings,
  markInserted,
  onDrawingsChanged,
  type NewVersion,
} from "./storage/history";
import { checkPrompt, checkRedraw, isVersion, toDrawingId } from "./ipcChecks";

/**
 * Everything the Vue windows can ask the main process to do. Values from the windows are
 * checked in ipcChecks.ts first. `handle` = request/response, `on` = fire-and-forget.
 */
export function registerIpcHandlers(): void {
  // Whenever history changes, every window's lists reload.
  onDrawingsChanged(() => {
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send(IPC.drawingsChanged);
    }
  });

  ipcMain.handle(IPC.getAppInfo, (): AppInfo => ({
    version: app.getVersion(),
    ...hotkeyInfo(),
  }));

  ipcMain.on(IPC.togglePanel, () => togglePanel());
  ipcMain.on(IPC.hidePanel, () => hidePanel());

  ipcMain.handle(IPC.hasApiKey, () => hasApiKey());
  ipcMain.handle(IPC.saveApiKey, (_event, key: unknown) => saveApiKey(key));
  ipcMain.handle(IPC.clearApiKey, () => clearApiKey());

  ipcMain.handle(
    IPC.generateDiagram,
    async (_event, prompt: unknown, drawingId: unknown) => {
      const checked = checkPrompt(prompt);
      if (!checked.ok) return checked;
      // With a drawing id this is an empty Redraw, so the new version joins that drawing.
      return saveDrawn(await generateDiagram(checked.value), {
        drawingId: toDrawingId(drawingId),
        description: checked.value,
        kind: "retry",
      });
    },
  );

  ipcMain.handle(IPC.redrawDiagram, async (_event, request: unknown) => {
    const checked = checkRedraw(request);
    if (!checked.ok) return checked;
    const { drawingId, description, change, marks } = checked.value;
    return saveDrawn(await redrawDiagram(checked.value), {
      drawingId,
      description,
      kind: "edit",
      change,
      marksSvg: marks?.svg,
    });
  });

  ipcMain.handle(
    IPC.approveDiagram,
    async (_event, png: unknown, drawingId: unknown, version: unknown) => {
      const result = await copyDiagramToClipboard(png);
      if (!result.ok) return result;

      // Switch back to the window the panel was opened from, hide the panel, and paste there.
      // When it can't (Notepad, the window closed…), the diagram is still on the clipboard.
      await pasteIntoTarget(hidePanel);

      const id = toDrawingId(drawingId);
      if (id && isVersion(version)) {
        await markInserted(id, version).catch((error) =>
          console.error("[picasso] couldn't mark the drawing inserted:", error),
        );
      }
      return result;
    },
  );

  ipcMain.handle(IPC.copyImage, (_event, png: unknown) =>
    copyDiagramToClipboard(png),
  );

  ipcMain.handle(IPC.listDrawings, () => listDrawings());
  ipcMain.handle(IPC.getDrawing, (_event, id: unknown) => {
    const drawingId = toDrawingId(id);
    return drawingId ? getDrawing(drawingId) : null;
  });
  ipcMain.handle(IPC.deleteDrawing, async (_event, id: unknown) => {
    const drawingId = toDrawingId(id);
    if (drawingId) await deleteDrawing(drawingId);
  });
}

/** Saves a successful drawing to history. Failures pass straight through to the panel. */
async function saveDrawn(
  result: AgentResponse,
  details: Omit<NewVersion, "svg" | "title">,
): Promise<DrawResult> {
  if (!result.ok) return result;
  const saved = await addVersion({
    ...details,
    svg: result.svg,
    title: result.title,
  });
  return { ok: true, svg: result.svg, ...saved };
}
