import { app } from "electron";
import { randomUUID } from "node:crypto";
import {
  mkdir,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import { join } from "node:path";
import type {
  Drawing,
  DrawingInfo,
  DrawingSummary,
  DrawingVersion,
  VersionKind,
} from "@shared/ipc";

// Every drawing is one folder in userData/drawings, named by its id:
//   drawing.json   title, description, dates, and the list of versions
//   v1.svg, v2.svg…  each version's SVG
//   v3-marks.svg     for an edit made with marks: the version before it with the red marks on top
// Plain files, so a drawing can be inspected by hand and deleted by deleting its folder.
// scripts/seed-drawings.mjs writes this same layout; keep the two in sync.

/** A version in drawing.json: its details without the SVGs, which live in their own files. */
type StoredVersion = Omit<DrawingVersion, "svg" | "marksSvg"> & {
  /** Whether a vN-marks.svg file exists for this version. */
  marked?: boolean;
};

/** drawing.json */
type StoredDrawing = DrawingInfo & { versions: StoredVersion[] };

/** What a newly drawn version brings with it. */
export interface NewVersion {
  /** The drawing to add to. Missing or deleted means a new drawing is started. */
  drawingId?: string;
  /** The diagram's name from Claude, used if this starts a new drawing. */
  title?: string;
  description: string;
  svg: string;
  kind: VersionKind;
  change?: string;
  /** For an edit made with marks: the previous version with the red marks drawn on top. */
  marksSvg?: string;
}

// Ids come from randomUUID(). Checking the exact shape also keeps an id from the
// renderer, like "../../somewhere", from ever reaching a file path.
const ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isDrawingId(id: unknown): id is string {
  return typeof id === "string" && ID_PATTERN.test(id);
}

let notifyChanged = (): void => {};

/** Runs `listener` after every change to history: a new version, an insert, or a delete. */
export function onDrawingsChanged(listener: () => void): void {
  notifyChanged = listener;
}

const drawingsDir = (): string => join(app.getPath("userData"), "drawings");

function drawingDir(id: string): string {
  if (!isDrawingId(id)) throw new Error(`Not a drawing id: ${id}`);
  return join(drawingsDir(), id);
}

const metaPath = (id: string): string => join(drawingDir(id), "drawing.json");
const svgPath = (id: string, version: number): string =>
  join(drawingDir(id), `v${version}.svg`);
const marksPath = (id: string, version: number): string =>
  join(drawingDir(id), `v${version}-marks.svg`);

/**
 * Saves a freshly drawn version and returns where it went. A failed write is logged rather
 * than thrown, so a diagram the user already paid for still shows up in the panel.
 */
export async function addVersion(
  input: NewVersion,
): Promise<{ drawingId: string; version: number }> {
  const existing = input.drawingId ? await readMeta(input.drawingId) : null;
  const now = new Date().toISOString();

  const meta: StoredDrawing = existing ?? {
    id: randomUUID(),
    title: input.title ?? shorten(input.description),
    description: input.description,
    createdAt: now,
    updatedAt: now,
    versions: [],
  };

  const version = meta.versions.length + 1;
  // Undefined fields are left out of drawing.json.
  meta.versions.push({
    number: version,
    kind: existing ? input.kind : "first",
    change: input.change || undefined,
    marked: input.marksSvg ? true : undefined,
    createdAt: now,
    inserted: false,
  });
  meta.updatedAt = now;

  try {
    await mkdir(drawingDir(meta.id), { recursive: true });
    await writeFile(svgPath(meta.id, version), input.svg, "utf8");
    if (input.marksSvg) {
      await writeFile(marksPath(meta.id, version), input.marksSvg, "utf8");
    }
    await writeMeta(meta);
  } catch (error) {
    console.error("[picasso] couldn't save the drawing:", error);
  }
  notifyChanged();
  return { drawingId: meta.id, version };
}

/** Marks a version as inserted into notes (the green Draw button). */
export async function markInserted(id: string, version: number): Promise<void> {
  const meta = await readMeta(id);
  const entry = meta?.versions.find((v) => v.number === version);
  if (!meta || !entry || entry.inserted) return;
  entry.inserted = true;
  await writeMeta(meta);
  notifyChanged();
}

/** Every drawing, newest first. Folders that can't be read are skipped. */
export async function listDrawings(): Promise<DrawingSummary[]> {
  let ids: string[];
  try {
    ids = (await readdir(drawingsDir())).filter(isDrawingId);
  } catch {
    return []; // nothing has been drawn yet, so the folder doesn't exist
  }

  const summaries = await Promise.all(
    ids.map(async (id): Promise<DrawingSummary | null> => {
      const meta = await readMeta(id);
      const latest = meta?.versions.at(-1);
      if (!meta || !latest) return null;
      const latestSvg = await readText(svgPath(id, latest.number));
      if (latestSvg === null) return null;
      return {
        id,
        title: meta.title,
        description: meta.description,
        createdAt: meta.createdAt,
        updatedAt: meta.updatedAt,
        versionCount: meta.versions.length,
        latestSvg,
        inserted: meta.versions.some((v) => v.inserted),
      };
    }),
  );

  // ISO timestamps sort correctly as plain strings.
  return summaries
    .filter((s): s is DrawingSummary => s !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

/** One drawing with every version's SVG, oldest first. */
export async function getDrawing(id: string): Promise<Drawing | null> {
  const meta = await readMeta(id);
  if (!meta) return null;

  // Read every version's files at once instead of one after another.
  const versions = await Promise.all(
    meta.versions.map(
      async ({ marked, ...entry }): Promise<DrawingVersion | null> => {
        const [svg, marksSvg] = await Promise.all([
          readText(svgPath(id, entry.number)),
          marked ? readText(marksPath(id, entry.number)) : null,
        ]);
        return svg === null
          ? null
          : { ...entry, svg, marksSvg: marksSvg ?? undefined };
      },
    ),
  );
  return {
    ...meta,
    versions: versions.filter((v): v is DrawingVersion => v !== null),
  };
}

export async function deleteDrawing(id: string): Promise<void> {
  await rm(drawingDir(id), { recursive: true, force: true });
  notifyChanged();
}

async function readMeta(id: string): Promise<StoredDrawing | null> {
  const text = await readText(metaPath(id));
  if (text === null) return null;
  try {
    const meta = JSON.parse(text) as StoredDrawing;
    return Array.isArray(meta.versions) ? meta : null;
  } catch {
    return null; // damaged
  }
}

/** Writes to a temporary file first, so a crash mid-write can't leave half a drawing.json. */
async function writeMeta(meta: StoredDrawing): Promise<void> {
  const file = metaPath(meta.id);
  await writeFile(`${file}.tmp`, JSON.stringify(meta, null, 2), "utf8");
  await rename(`${file}.tmp`, file);
}

/** A file's text, or null if it's missing. */
async function readText(path: string): Promise<string | null> {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

/** Fallback title: the start of what the student typed. */
function shorten(description: string): string {
  const text = description.replace(/\s+/g, " ").trim();
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}
