import { app, Tray, Menu, nativeImage } from "electron";
import { showMainWindow } from "./windows/mainWindow";
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
