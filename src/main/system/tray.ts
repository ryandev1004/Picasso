import { app, Tray, Menu, nativeImage } from "electron";
import { showMainWindow } from "../windows/mainWindow";
import {
  canLaunchAtLogin,
  isLaunchAtLoginEnabled,
  setLaunchAtLogin,
} from "./launchAtLogin";
// Drawn from resources/tray.svg by `npm run icons`.
import trayIconPath from "../../../resources/tray.ico?asset";

export function createTray(): Tray {
  const tray = new Tray(nativeImage.createFromPath(trayIconPath));

  const contextMenu = Menu.buildFromTemplate([
    { label: "Show", click: () => showMainWindow() },
    {
      label: canLaunchAtLogin
        ? "Launch at login"
        : "Launch at login (installed app only)",
      type: "checkbox",
      checked: isLaunchAtLoginEnabled(),
      enabled: canLaunchAtLogin,
      // Electron flips `checked` before calling this, so it's already the new setting.
      click: (item) => setLaunchAtLogin(item.checked),
    },
    { type: "separator" },
    { label: "Exit", click: () => app.quit() },
  ]);

  tray.on("double-click", () => showMainWindow());
  tray.setToolTip("Picasso");
  tray.setContextMenu(contextMenu);
  return tray;
}
