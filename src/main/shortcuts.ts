import { globalShortcut } from "electron";
import { togglePanel } from "./windows/panelWindow";

/**
 * Opens the panel system-wide, even when Picasso isn't focused.
 * This is a fallback for the native sidecar hotkey.
 */
export const PANEL_HOTKEY = "CommandOrControl+Shift+D";

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

/** "CommandOrControl+Shift+D" -> "Ctrl+Shift+D" (or "Cmd+..." on macOS). */
export function displayHotkey(accelerator: string): string {
  return accelerator.replace(
    "CommandOrControl",
    process.platform === "darwin" ? "Cmd" : "Ctrl",
  );
}
