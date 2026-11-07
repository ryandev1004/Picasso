import { clipboard, ClipboardItem, nativeImage } from "electron";
import type { Result } from "@shared/ipc";

// A 2x PNG of an 800x600 diagram is well under 1 MB, so anything this big isn't one of ours.
const MAX_PNG_BYTES = 20 * 1024 * 1024;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const COPY_FAILED = "That diagram couldn't be copied. Try Redraw.";

/** Whether `value` is PNG bytes (it starts with the PNG file signature) of at most `maxBytes`. */
export function isPng(value: unknown, maxBytes: number): value is Uint8Array {
  return (
    value instanceof Uint8Array &&
    value.byteLength > PNG_SIGNATURE.length &&
    value.byteLength <= maxBytes &&
    PNG_SIGNATURE.every((byte, i) => value[i] === byte)
  );
}

/**
 * Puts a diagram (PNG bytes from the renderer) on the clipboard. Used by the panel's Draw
 * button, which then pastes it, and by Copy in the main window's Thread view.
 */
export async function copyDiagramToClipboard(png: unknown): Promise<Result> {
  if (!isPng(png, MAX_PNG_BYTES)) return { ok: false, error: COPY_FAILED };

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
