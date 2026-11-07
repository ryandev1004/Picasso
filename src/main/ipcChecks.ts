import type { RedrawRequest, Result } from "@shared/ipc";
import { isPng } from "./paste/clipboard";
import { isDrawingId } from "./storage/history";

// Checks for everything that arrives from the Vue windows. Anything can come over IPC, so
// each value is checked here, once, before it reaches Claude, the clipboard or the disk.

const MAX_PROMPT_LENGTH = 1000;
// A diagram is a few thousand characters, so this leaves lots of room.
const MAX_SVG_LENGTH = 100_000;
// The diagram plus hand-drawn marks (long pen strokes add path data).
const MAX_MARKED_SVG_LENGTH = 300_000;
// The ~1000px picture of a marked-up diagram is well under 1 MB.
const MAX_MARKS_PNG_BYTES = 8 * 1024 * 1024;

const TOO_LONG = "That’s too long. Try a shorter description.";
const INVALID_REDRAW = "Invalid redraw request";

/** A Generate prompt, trimmed: not empty and not too long. */
export function checkPrompt(prompt: unknown): Result<{ value: string }> {
  if (typeof prompt !== "string") return { ok: false, error: "Invalid prompt" };
  const text = prompt.trim();
  if (text === "") {
    return { ok: false, error: "Type what you want drawn first." };
  }
  if (text.length > MAX_PROMPT_LENGTH) return { ok: false, error: TOO_LONG };
  return { ok: true, value: text };
}

/** A Redraw request: the texts trimmed, the SVGs and marks picture sanity-checked. */
export function checkRedraw(
  request: unknown,
): Result<{ value: RedrawRequest }> {
  if (typeof request !== "object" || request === null) {
    return { ok: false, error: INVALID_REDRAW };
  }
  const { description, svg, change, drawingId, marks } = request as Record<
    string,
    unknown
  >;
  if (
    typeof description !== "string" ||
    typeof svg !== "string" ||
    typeof change !== "string"
  ) {
    return { ok: false, error: INVALID_REDRAW };
  }

  const cleanDescription = description.trim();
  const cleanChange = change.trim();
  if (cleanChange === "") {
    return { ok: false, error: "Type what should change first." };
  }
  if (
    cleanDescription.length > MAX_PROMPT_LENGTH ||
    cleanChange.length > MAX_PROMPT_LENGTH
  ) {
    return { ok: false, error: TOO_LONG };
  }
  if (!isSvg(svg, MAX_SVG_LENGTH)) {
    return {
      ok: false,
      error: "The current diagram couldn't be sent. Try a fresh drawing.",
    };
  }

  // Marks are optional: the diagram with marks on top as SVG (for history) and as a PNG (for Claude).
  let checkedMarks: RedrawRequest["marks"];
  if (marks != null) {
    const { svg: marksSvg, png } = marks as Record<string, unknown>;
    if (
      !isSvg(marksSvg, MAX_MARKED_SVG_LENGTH) ||
      !isPng(png, MAX_MARKS_PNG_BYTES)
    ) {
      return {
        ok: false,
        error: "Your marks couldn't be sent. Try drawing them again.",
      };
    }
    checkedMarks = { svg: marksSvg, png };
  }

  return {
    ok: true,
    value: {
      description: cleanDescription,
      svg,
      change: cleanChange,
      drawingId: toDrawingId(drawingId),
      marks: checkedMarks,
    },
  };
}

/** A drawing id from the renderer, or undefined if it isn't one (so storage only sees real ids). */
export function toDrawingId(value: unknown): string | undefined {
  return isDrawingId(value) ? value : undefined;
}

/** A version number (v1, v2…). */
export function isVersion(value: unknown): value is number {
  return Number.isInteger(value);
}

function isSvg(value: unknown, maxLength: number): value is string {
  return (
    typeof value === "string" &&
    value.trimStart().startsWith("<svg") &&
    value.length <= maxLength
  );
}
