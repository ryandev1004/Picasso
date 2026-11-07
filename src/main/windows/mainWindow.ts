import { BrowserWindow, shell } from "electron";
import { loadPage, webPreferences } from "./loadPage";
import appIconPath from "../../../resources/icon.ico?asset";

let win: BrowserWindow | null = null;

// Height of the window-button strip. MainApp.vue's drag area reads it back with env(titlebar-area-height).
const TITLE_BAR_HEIGHT = 36;

/** The full app window: your saved drawings and Settings. */
export function createMainWindow(): BrowserWindow {
  win = new BrowserWindow({
    width: 1000,
    height: 700,
    minWidth: 640,
    minHeight: 480,
    title: "Picasso",
    icon: appIconPath, // the taskbar and Alt+Tab icon (resources/icon.svg)
    show: false,
    autoHideMenuBar: true,
    // No Windows title bar, but keep its real minimize/maximize/close buttons (so Snap
    // Layouts still work), drawn over the top-right corner in Picasso's colors.
    titleBarStyle: "hidden",
    titleBarOverlay: {
      color: "#f8f5f0", // --bg in base.css
      symbolColor: "#24211c", // --text
      height: TITLE_BAR_HEIGHT,
    },
    webPreferences,
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
