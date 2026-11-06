import { app, globalShortcut, ipcMain } from "electron";
import { IPC, type AppInfo, type RedrawRequest } from "@shared/ipc";
import { displayHotkey, PANEL_HOTKEY } from "./shortcuts";
import { hidePanel, togglePanel } from "./windows/panelWindow";
import { clearApiKey, hasApiKey, saveApiKey } from "./settings";
import { generateDiagram, redrawDiagram } from "./agent/response";
import { copyDiagramToClipboard } from "./clipboard";

const MAX_PROMPT_LENGTH = 1000;
// A diagram is a few thousand characters, so this leaves lots of room.
const MAX_SVG_LENGTH = 100_000;

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
  ipcMain.handle(IPC.generateDiagram, (_event, prompt: unknown) => {
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
      return generateDiagram(input);
    }
  });
  ipcMain.handle(IPC.redrawDiagram, (_event, request: unknown) => {
    const checked = checkRedraw(request);
    if (typeof checked === "string") return { ok: false, error: checked };
    return redrawDiagram(checked);
  });
  ipcMain.handle(IPC.approveDiagram, async (_event, png: unknown) => {
    const result = await copyDiagramToClipboard(png);
    // Hiding the panel hands focus back to the notes app, ready for Ctrl+V.
    if (result.ok) hidePanel();
    return result;
  });
}

/**
 * Checks a Redraw request from the panel before it reaches Claude (anything can arrive over IPC).
 * Returns the cleaned-up request, or an error message to show the user.
 */
function checkRedraw(request: unknown): RedrawRequest | string {
  if (typeof request !== "object" || request === null) {
    return "Invalid redraw request";
  }
  const { description, svg, change } = request as Record<string, unknown>;
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

  return { description: cleanDescription, svg, change: cleanChange };
}
