import { app, BrowserWindow } from 'electron'
import { createMainWindow } from './windows/mainWindow'
import { createPanelWindow } from './windows/panelWindow'
import { registerShortcuts, unregisterShortcuts } from './shortcuts'
import { registerIpcHandlers } from './ipc'

// Only one Picasso may run at a time, otherwise two copies fight over the global hotkey.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  let mainWindow: BrowserWindow | null = null

  app.on('second-instance', () => {
    if (!mainWindow) return
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.focus()
  })

  app.whenReady().then(() => {
    registerIpcHandlers()

    mainWindow = createMainWindow()
    
    // TODO: Handle closing to tray instead of closing then quitting the whole app.
    mainWindow.on('closed', () => {
      mainWindow = null
      app.quit()
    })

    // Create the panel up front (hidden) so the hotkey opens it instantly.
    createPanelWindow()
    registerShortcuts()

    app.on('activate', () => {
      if (!mainWindow) mainWindow = createMainWindow()
    })
  })

  app.on('will-quit', unregisterShortcuts)
}
