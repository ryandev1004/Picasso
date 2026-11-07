import { app, BrowserWindow } from "electron";
import { join } from "node:path";

type Page = "index" | "panel";

/** Path to the bundled preload script, shared by every window. */
export const preloadPath = join(__dirname, "../preload/index.js");

/**
 * Loads one of the renderer's HTML pages into a window.
 * In dev this is the Vite server (with hot reload); in a build it's the file on disk.
 */
export function loadPage(win: BrowserWindow, page: Page): void {
  const devServerUrl = process.env.ELECTRON_RENDERER_URL;
  if (!app.isPackaged && devServerUrl) {
    win.loadURL(`${devServerUrl}/${page}.html`);
  } else {
    win.loadFile(join(__dirname, `../renderer/${page}.html`));
  }
}
