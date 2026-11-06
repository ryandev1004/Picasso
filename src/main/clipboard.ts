import { clipboard, ClipboardItem, nativeImage } from "electron";
import type { ApproveDiagramResult } from "@shared/ipc";

// A 2x PNG of an 800x600 diagram is well under 1 MB, so anything this big isn't one of ours.
const MAX_PNG_BYTES = 20 * 1024 * 1024;
const COPY_FAILED = "That diagram couldn't be copied. Try Redraw.";

/**
 * Puts an approved diagram on the clipboard so the user can press Ctrl+V in their notes.
 * Later the sidecar pastes it for them; until then, this is the whole "insert" step.
 */
export async function copyDiagramToClipboard(
  png: unknown,
): Promise<ApproveDiagramResult> {
  // Anything can arrive over IPC, so check it's really PNG-sized bytes first.
  if (
    !(png instanceof Uint8Array) ||
    png.byteLength === 0 ||
    png.byteLength > MAX_PNG_BYTES
  ) {
    return { ok: false, error: COPY_FAILED };
  }

  // Decode and re-encode, so only a real image made here ever reaches the clipboard.
  const image = nativeImage.createFromBuffer(Buffer.from(png));
  if (image.isEmpty()) return { ok: false, error: COPY_FAILED };

  try {
    // Electron 44 replaced clipboard.writeImage() with this W3C-style write().
    await clipboard.write([
      new ClipboardItem({
        "image/png": new Blob([new Uint8Array(image.toPNG())], {
          type: "image/png",
        }),
      }),
    ]);
  } catch (error) {
    console.error("[picasso] couldn't write the clipboard:", error);
    return { ok: false, error: COPY_FAILED };
  }
  return { ok: true };
}
