import { app, Tray } from "electron";
import { createMainWindow, showMainWindow } from "./windows/mainWindow";
import { createPanelWindow } from "./windows/panelWindow";
import { registerShortcuts, unregisterShortcuts } from "./system/shortcuts";
import { registerIpcHandlers } from "./ipc";
import { createTray } from "./system/tray";
import { wasLaunchedAtLogin } from "./system/launchAtLogin";

// Only one Picasso may run at a time, otherwise two copies fight over the global hotkey.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  // Hold onto the tray, or it can be garbage-collected and the icon vanishes.
  let tray: Tray | null = null;

  app.on("second-instance", () => showMainWindow());

  app.whenReady().then(() => {
    registerIpcHandlers();

    // Started by Windows at login: stay in the tray until someone opens the window.
    if (!wasLaunchedAtLogin()) createMainWindow();

    // Create the panel up front (hidden) so the hotkey opens it instantly.
    createPanelWindow();
    registerShortcuts();

    tray = createTray();

    app.on("activate", () => showMainWindow());
  });

  // When a user closes their window, we prevent the app from quitting so it stays in the tray.
  app.on("window-all-closed", () => {});

  app.on("will-quit", () => {
    unregisterShortcuts();
    tray?.destroy();
  });
}
