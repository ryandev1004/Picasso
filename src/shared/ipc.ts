// The contract between the main process and the Vue windows.
// Both sides import from here, so channel names can never drift apart.

export const IPC = {
  getAppInfo: 'app:get-info',
  togglePanel: 'panel:toggle',
  hidePanel: 'panel:hide',
  panelShown: 'panel:shown',
  hasApiKey: 'apiKey:has',
  saveApiKey: 'apiKey:save',
  clearApiKey: 'apiKey:clear',
} as const

export interface AppInfo {
  version: string
  /** Human-readable hotkey, e.g. "Ctrl+Shift+D". */
  hotkey: string
  /** False if another app already owns the hotkey, so pressing it won't reach Picasso. */
  hotkeyActive: boolean
}

/** Result of saving the API key. On failure, `error` is a message to show the user. */
export type SaveApiKeyResult = { ok: true } | { ok: false; error: string }

/** Result of generating a diagram. On success, `svg` is the diagram's markup; on failure, `error` is a message to show the user. */
export type AgentResponse = { ok: true; svg: string } | { ok: false; error: string }

/** What the preload script exposes to the Vue windows as `window.picasso`. */
export interface PicassoAPI {
  getAppInfo(): Promise<AppInfo>
  togglePanel(): void
  hidePanel(): void
  /** Runs `callback` every time the panel is shown. Returns an unsubscribe function. */
  onPanelShown(callback: () => void): () => void
  /** Whether a Claude API key is saved. There's deliberately no way to read the key itself. */
  hasApiKey(): Promise<boolean>
  saveApiKey(key: string): Promise<SaveApiKeyResult>
  clearApiKey(): Promise<void>
}
