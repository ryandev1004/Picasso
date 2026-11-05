import { app, globalShortcut, ipcMain } from 'electron'
import { IPC, type AppInfo } from '@shared/ipc'
import { displayHotkey, PANEL_HOTKEY } from './shortcuts'
import { hidePanel, togglePanel } from './windows/panelWindow'

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
}
