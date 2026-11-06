// Helpers for turning Claude's SVG into something the panel can show and copy.

/** A `data:` URL for an `<img>` tag. An <img> never runs scripts inside an SVG, so this is safe to show. */
export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

/**
 * Draws the SVG onto a canvas and returns PNG bytes, which every notes app can paste.
 * `scale` 2 keeps it sharp on high-DPI screens.
 */
export async function svgToPng(svg: string, scale = 2): Promise<Uint8Array> {
  const img = new Image();
  img.src = svgDataUrl(svg);
  await img.decode();

  // The system prompt asks for width/height attributes; fall back to the max size if they're missing.
  const width = img.naturalWidth || 800;
  const height = img.naturalHeight || 600;

  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D isn't available");
  ctx.fillStyle = "#ffffff"; // in case the SVG skipped its white background
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png"),
  );
  if (!blob) throw new Error("Couldn't encode the PNG");
  return new Uint8Array(await blob.arrayBuffer());
}
