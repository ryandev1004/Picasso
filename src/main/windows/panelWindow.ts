import { BrowserWindow, screen } from "electron";
import { IPC } from "@shared/ipc";
import { loadPage, webPreferences } from "./loadPage";
import { getTarget, rememberTarget } from "../paste/pasteTarget";
import appIconPath from "../../../resources/icon.ico?asset";

// Sized to the panel design (picassomini).
const WIDTH = 480;
const HEIGHT = 520;
const EDGE_MARGIN = 16;

let panel: BrowserWindow | null = null;

/**
 * The floating quick-draw panel the hotkey summons. It's created once at startup and then
 * shown/hidden, never closed, so it pops up with no loading delay.
 */
export function createPanelWindow(): BrowserWindow {
  panel = new BrowserWindow({
    width: WIDTH,
    height: HEIGHT,
    show: false,
    frame: false,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    icon: appIconPath,
    webPreferences,
  });

  panel.on("closed", () => {
    panel = null;
  });

  loadPage(panel, "panel");
  return panel;
}

function showPanel(): void {
  if (!panel) return;

  // Before the panel takes focus, note the window you were typing in, so Draw can paste there.
  rememberTarget();

  // Dock to the right edge of whichever screen the mouse is on.
  const { workArea } = screen.getDisplayNearestPoint(
    screen.getCursorScreenPoint(),
  );
  panel.setPosition(
    Math.round(workArea.x + workArea.width - WIDTH - EDGE_MARGIN),
    Math.round(workArea.y + (workArea.height - HEIGHT) / 2),
  );

  panel.show();
  panel.focus();
  panel.webContents.send(IPC.panelShown, getTarget());
}

export function hidePanel(): void {
  panel?.hide();
}

export function togglePanel(): void {
  if (panel?.isVisible()) hidePanel();
  else showPanel();
}
