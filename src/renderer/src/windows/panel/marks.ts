// The red marks you draw on the panel's preview: what a mark is, the shapes that draw it,
// and the marked-up diagram that Redraw sends to Claude (and history keeps).
// Marks use the diagram's own coordinates, so they line up at any preview size.

export interface Point {
  x: number;
  y: number;
}

export type Mark =
  { kind: "pen"; points: Point[] } | { kind: "arrow"; from: Point; to: Point };

export type Tool = "pen" | "arrow" | "erase";

/** Bright red, so marks stand out from the diagram's own colors. */
export const MARK_COLOR = "#e5484d";

/** The diagram's coordinate box. */
export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Reads the diagram's viewBox, falling back to its width/height, then to 800×600. */
export function viewBoxOf(svg: string): Box {
  const openTag = /<svg\b[^>]*>/i.exec(svg)?.[0] ?? "";
  const viewBox =
    /viewBox\s*=\s*["']\s*([-\d.eE]+)[\s,]+([-\d.eE]+)[\s,]+([-\d.eE]+)[\s,]+([-\d.eE]+)\s*["']/i.exec(
      openTag,
    );
  if (viewBox) {
    const [x, y, width, height] = viewBox.slice(1).map(Number);
    if (width > 0 && height > 0) return { x, y, width, height };
  }
  // (?:^|\s) so "stroke-width" isn't mistaken for "width".
  const width = Number(/(?:^|\s)width\s*=\s*["']([\d.]+)/i.exec(openTag)?.[1]);
  const height = Number(
    /(?:^|\s)height\s*=\s*["']([\d.]+)/i.exec(openTag)?.[1],
  );
  return width > 0 && height > 0
    ? { x: 0, y: 0, width, height }
    : { x: 0, y: 0, width: 800, height: 600 };
}

/** Line thickness in diagram units: about 5 on an 800-wide diagram, whatever its size. */
export function markWidth(box: Box): number {
  return Math.max(box.width, box.height) / 160;
}

/** One piece of a drawn mark: a stroked line, or a filled shape (an arrowhead). */
export interface MarkShape {
  d: string;
  filled: boolean;
}

const round = (n: number): number => Math.round(n * 10) / 10;
const at = (p: Point): string => `${round(p.x)} ${round(p.y)}`;

/** The SVG path data that draws a mark. */
export function shapesFor(mark: Mark, width: number): MarkShape[] {
  if (mark.kind === "pen") {
    const [first, ...rest] = mark.points;
    if (!first) return [];
    // A single tap still shows up as a dot.
    const d = rest.length
      ? `M${at(first)}${rest.map((p) => `L${at(p)}`).join("")}`
      : `M${at(first)}h0.01`;
    return [{ d, filled: false }];
  }

  const { from, to } = mark;
  const length = Math.hypot(to.x - from.x, to.y - from.y) || 1;
  const along = { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
  const across = { x: -along.y, y: along.x };
  const headLength = width * 4;
  const headHalfWidth = width * 2.4;
  const base = {
    x: to.x - along.x * headLength,
    y: to.y - along.y * headLength,
  };
  const left = {
    x: base.x + across.x * headHalfWidth,
    y: base.y + across.y * headHalfWidth,
  };
  const right = {
    x: base.x - across.x * headHalfWidth,
    y: base.y - across.y * headHalfWidth,
  };
  return [
    { d: `M${at(from)}L${at(base)}`, filled: false },
    { d: `M${at(to)}L${at(left)}L${at(right)}Z`, filled: true },
  ];
}

/** Whether `point` is within `reach` of a mark's line (used by Erase). */
export function touches(mark: Mark, point: Point, reach: number): boolean {
  const points = mark.kind === "pen" ? mark.points : [mark.from, mark.to];
  if (points.length === 1) return distance(point, points[0]) <= reach;
  for (let i = 1; i < points.length; i++) {
    if (distanceToSegment(point, points[i - 1], points[i]) <= reach) {
      return true;
    }
  }
  return false;
}

export function distance(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function distanceToSegment(p: Point, a: Point, b: Point): number {
  const lengthSquared = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  if (lengthSquared === 0) return distance(p, a);
  const t = Math.max(
    0,
    Math.min(
      1,
      ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / lengthSquared,
    ),
  );
  return distance(p, { x: a.x + t * (b.x - a.x), y: a.y + t * (b.y - a.y) });
}

/**
 * The diagram with the marks drawn on top, as one SVG. Redraw turns this into the
 * picture Claude sees, and history saves it so Thread can show what you marked.
 */
export function withMarks(svg: string, marks: Mark[]): string {
  const end = svg.lastIndexOf("</svg>");
  if (end === -1 || marks.length === 0) return svg;
  const width = markWidth(viewBoxOf(svg));
  const paths = marks
    .flatMap((mark) => shapesFor(mark, width))
    .map((shape) =>
      shape.filled
        ? `<path d="${shape.d}" fill="${MARK_COLOR}"/>`
        : `<path d="${shape.d}" fill="none" stroke="${MARK_COLOR}" stroke-width="${round(width)}" stroke-linecap="round" stroke-linejoin="round"/>`,
    )
    .join("");
  return `${svg.slice(0, end)}<g id="picasso-student-marks">${paths}</g>${svg.slice(end)}`;
}

/**
 * How much to enlarge the marked-up picture for Claude: about 1000px on its long side,
 * enough to see the marks clearly without spending extra tokens on a huge image.
 */
export function pictureScale(svg: string): number {
  const box = viewBoxOf(svg);
  return Math.min(2, Math.max(1, 1000 / Math.max(box.width, box.height)));
}
