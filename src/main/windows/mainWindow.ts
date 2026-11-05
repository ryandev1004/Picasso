import { BrowserWindow, shell } from 'electron'
import { loadPage, preloadPath } from './loadPage'

/** The full app window: home screen, and later your saved drawings and settings. */
export function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 640,
    minHeight: 480,
    title: 'Picasso',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
    },
  })

  win.once('ready-to-show', () => win.show())

  // Open external links in the user's browser instead of a new Electron window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  loadPage(win, 'index')
  return win
}
