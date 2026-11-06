// The contract between the main process and the Vue windows.
// Both sides import from here, so channel names can never drift apart.

export const IPC = {
  getAppInfo: "app:get-info",
  togglePanel: "panel:toggle",
  hidePanel: "panel:hide",
  panelShown: "panel:shown",
  hasApiKey: "apiKey:has",
  saveApiKey: "apiKey:save",
  clearApiKey: "apiKey:clear",
  generateDiagram: "agent:generate-diagram",
  redrawDiagram: "agent:redraw-diagram",
  approveDiagram: "diagram:approve",
  copyImage: "diagram:copy-image",
  listDrawings: "drawings:list",
  getDrawing: "drawings:get",
  deleteDrawing: "drawings:delete",
  drawingsChanged: "drawings:changed",
} as const;

export interface AppInfo {
  version: string;
  /** Human-readable hotkey, e.g. "Ctrl+Shift+D". */
  hotkey: string;
  /** False if another app already owns the hotkey, so pressing it won't reach Picasso. */
  hotkeyActive: boolean;
}

/** Result of saving the API key. On failure, `error` is a message to show the user. */
export type SaveApiKeyResult = { ok: true } | { ok: false; error: string };

/** Result of generating a diagram. On success, `svg` is the diagram's markup; on failure, `error` is a message to show the user. */
export type AgentResponse =
  { ok: true; svg: string } | { ok: false; error: string };

/**
 * What the panel gets back from a Generate or Redraw. On success the new version is
 * already saved to history: `drawingId` is the drawing it belongs to, `version` its number (v1, v2…).
 */
export type DrawResult =
  | { ok: true; svg: string; drawingId: string; version: number }
  | { ok: false; error: string };

/** What Redraw sends: the first description, the diagram on screen, and what to change about it. */
export interface RedrawRequest {
  description: string;
  svg: string;
  change: string;
  /** The drawing the new version is saved under. */
  drawingId?: string;
}

/** Result of approving a diagram. On failure, `error` is a message to show the user. */
export type ApproveDiagramResult = { ok: true } | { ok: false; error: string };

/** How a version came about: the first drawing, an edit from "What should change?", or an empty Redraw. */
export type VersionKind = "first" | "edit" | "retry";

/** One saved version of a drawing (the "v1", "v2"… in the panel). */
export interface DrawingVersion {
  /** 1, 2, 3… matching the panel's badge. */
  number: number;
  kind: VersionKind;
  /** For an edit, the change that was asked for. */
  change?: string;
  /** ISO timestamp, e.g. "2026-11-06T15:42:10.000Z". */
  createdAt: string;
  /** Whether this version was inserted into notes with the Draw button. */
  inserted: boolean;
  svg: string;
}

/** A drawing as the sidebar list and grid need it. */
export interface DrawingSummary {
  id: string;
  /** Short name Claude gives the diagram, like "Krebs cycle, simplified". */
  title: string;
  /** What the student first typed. */
  description: string;
  createdAt: string;
  /** When the newest version was drawn. Lists are sorted by this, newest first. */
  updatedAt: string;
  versionCount: number;
  /** The newest version's SVG, for the thumbnail. */
  latestSvg: string;
  /** Whether any version was inserted into notes. */
  inserted: boolean;
}

/** A whole drawing with every version, oldest first, for the opened view and Thread. */
export interface Drawing {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  versions: DrawingVersion[];
}

/** What the preload script exposes to the Vue windows as `window.picasso`. */
export interface PicassoAPI {
  getAppInfo(): Promise<AppInfo>;
  togglePanel(): void;
  hidePanel(): void;
  /** Runs `callback` every time the panel is shown. Returns an unsubscribe function. */
  onPanelShown(callback: () => void): () => void;
  /** Whether a Claude API key is saved. There's deliberately no way to read the key itself. */
  hasApiKey(): Promise<boolean>;
  saveApiKey(key: string): Promise<SaveApiKeyResult>;
  clearApiKey(): Promise<void>;
  /**
   * Draws a diagram from the prompt and saves it. Without `drawingId` it starts a new drawing;
   * with one, it adds a fresh version to that drawing (an empty Redraw).
   */
  generateDiagram(prompt: string, drawingId?: string): Promise<DrawResult>;
  /** Edits the diagram on screen according to `change`, keeping the rest of it the same. */
  redrawDiagram(request: RedrawRequest): Promise<DrawResult>;
  /**
   * Puts the approved diagram (PNG bytes) on the clipboard and hides the panel. Passing the
   * drawing and version marks that version as inserted in history.
   */
  approveDiagram(
    png: Uint8Array,
    drawingId?: string,
    version?: number,
  ): Promise<ApproveDiagramResult>;
  /** Puts PNG bytes on the clipboard, like approveDiagram but without touching the panel. */
  copyImage(png: Uint8Array): Promise<ApproveDiagramResult>;
  /** Every saved drawing, newest first. */
  listDrawings(): Promise<DrawingSummary[]>;
  /** One drawing with all of its versions, or null if it doesn't exist. */
  getDrawing(id: string): Promise<Drawing | null>;
  /** Deletes a drawing and all of its versions. */
  deleteDrawing(id: string): Promise<void>;
  /** Runs `callback` whenever a drawing is added, changed or deleted. Returns an unsubscribe function. */
  onDrawingsChanged(callback: () => void): () => void;
}
