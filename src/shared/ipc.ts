// The contract between the main process and the Vue windows.
// Both sides import from here, so channel names can never drift apart.

export const IPC = {
  getAppInfo: 'app:get-info',
  togglePanel: 'panel:toggle',
  hidePanel: 'panel:hide',
  panelShown: 'panel:shown',
} as const

export interface AppInfo {
  version: string
  /** Human-readable hotkey, e.g. "Ctrl+Shift+D". */
  hotkey: string
  /** False if another app already owns the hotkey, so pressing it won't reach Picasso. */
  hotkeyActive: boolean
}

/** What the preload script exposes to the Vue windows as `window.picasso`. */
export interface PicassoAPI {
  getAppInfo(): Promise<AppInfo>
  togglePanel(): void
  hidePanel(): void
  /** Runs `callback` every time the panel is shown. Returns an unsubscribe function. */
  onPanelShown(callback: () => void): () => void
}
