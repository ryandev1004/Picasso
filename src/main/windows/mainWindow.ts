import { BrowserWindow, shell } from "electron";
import { loadPage, preloadPath } from "./loadPage";

let win: BrowserWindow | null = null;

/** The full app window: home screen, and later your saved drawings and settings. */
export function createMainWindow(): BrowserWindow {
  win = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 640,
    minHeight: 480,
    title: "Picasso",
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: preloadPath,
      sandbox: true,
    },
  });

  win.once("ready-to-show", () => win?.show());

  // Clicking X destroys the window; forget it so showMainWindow() builds a fresh one.
  win.on("closed", () => {
    win = null;
  });

  // Open external links in the user's browser instead of a new Electron window.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });

  loadPage(win, "index");
  return win;
}

export function showMainWindow(): void {
  // Closed earlier (or never opened): create it. It shows itself once it's ready.
  if (!win) {
    createMainWindow();
    return;
  }

  win.show();
  win.focus();
}
