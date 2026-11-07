import { globalShortcut } from "electron";
import type { AppInfo } from "@shared/ipc";
import { togglePanel } from "../windows/panelWindow";

/** Opens the panel from anywhere in Windows, even when Picasso isn't focused. */
const PANEL_HOTKEY = "CommandOrControl+Shift+D";

export function registerShortcuts(): void {
  const ok = globalShortcut.register(PANEL_HOTKEY, togglePanel);
  if (!ok) {
    console.warn(
      `[picasso] Could not register ${PANEL_HOTKEY}. Another app may already be using it.`,
    );
  }
}

export function unregisterShortcuts(): void {
  globalShortcut.unregisterAll();
}

/** The hotkey as people write it ("Ctrl+Shift+D"), and whether Picasso actually got it. */
export function hotkeyInfo(): Pick<AppInfo, "hotkey" | "hotkeyActive"> {
  const modifier = process.platform === "darwin" ? "Cmd" : "Ctrl";
  return {
    hotkey: PANEL_HOTKEY.replace("CommandOrControl", modifier),
    hotkeyActive: globalShortcut.isRegistered(PANEL_HOTKEY),
  };
}
