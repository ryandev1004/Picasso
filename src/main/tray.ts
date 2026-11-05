import { app, Tray, Menu, nativeImage } from "electron";
import { showMainWindow } from "./windows/mainWindow";
import { canLaunchAtLogin, isLaunchAtLoginEnabled, setLaunchAtLogin } from "./launchAtLogin";
// I just had claude generate me a temporary file for this cus I was too lazy to go find one myself.
// Sue me.
import trayIconPath from "../../resources/tray.ico?asset";

export function createTray(): Tray {
  let appIcon = new Tray(nativeImage.createFromPath(trayIconPath));

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show",
      click: () => {
        showMainWindow();
      },
    },
    {
      label: canLaunchAtLogin ? "Launch at login" : "Launch at login (installed app only)",
      type: "checkbox",
      checked: isLaunchAtLoginEnabled(),
      enabled: canLaunchAtLogin,
      // Electron flips `checked` before calling this, so it's already the new setting.
      click: (item) => setLaunchAtLogin(item.checked),
    },
    { type: "separator" },
    {
      label: "Exit",
      click: () => {
        app.quit();
      },
    },
  ]);

  appIcon.on("double-click", function () {
    showMainWindow();
  });

  appIcon.setToolTip("Picasso");
  appIcon.setContextMenu(contextMenu);
  return appIcon;
}
