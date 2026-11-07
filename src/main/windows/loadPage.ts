import { app, BrowserWindow } from "electron";
import { join } from "node:path";

type Page = "index" | "panel";

/** What every Picasso window shares: the preload bridge (window.picasso) and a sandboxed page. */
export const webPreferences = {
  preload: join(__dirname, "../preload/index.js"),
  sandbox: true,
};

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
