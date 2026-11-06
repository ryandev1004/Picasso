import { app, globalShortcut, ipcMain } from 'electron'
import { IPC, type AppInfo } from '@shared/ipc'
import { displayHotkey, PANEL_HOTKEY } from './shortcuts'
import { hidePanel, togglePanel } from './windows/panelWindow'
import { clearApiKey, hasApiKey, saveApiKey } from './settings'
import { generateDiagram } from './agent/response'

const MAX_PROMPT_LENGTH = 1000;

/**
 * Everything the Vue windows can ask the main process to do.
 * `handle` = request/response (renderer awaits a result). `on` = fire-and-forget.
 */
export function registerIpcHandlers(): void {
  ipcMain.handle(IPC.getAppInfo, (): AppInfo => ({
    version: app.getVersion(),
    hotkey: displayHotkey(PANEL_HOTKEY),
    hotkeyActive: globalShortcut.isRegistered(PANEL_HOTKEY),
  }))

  ipcMain.on(IPC.togglePanel, () => togglePanel())
  ipcMain.on(IPC.hidePanel, () => hidePanel())

  ipcMain.handle(IPC.hasApiKey, () => hasApiKey())
  ipcMain.handle(IPC.saveApiKey, (_event, key: unknown) => saveApiKey(key))
  ipcMain.handle(IPC.clearApiKey, () => clearApiKey())
  ipcMain.handle(IPC.generateDiagram, (_event, prompt: unknown) => {
    if (typeof prompt !== "string") {
      return { ok: false, error: "Invalid prompt" }
    } else {
      const input = prompt.trim();
      if (input === "") { return { ok: false, error: "Type what you want drawn first." }}
      if (input.length > MAX_PROMPT_LENGTH) { return { ok: false, error: "That’s too long. Try a shorter description." }}
      return generateDiagram(input); 
    }
  })
}
