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
  DrawingSummary,
  DrawingVersion,
  VersionKind,
} from "@shared/ipc";

// Every drawing is one folder in userData/drawings, named by its id:
//   drawing.json   title, description, dates, and the list of versions
//   v1.svg, v2.svg…  each version's SVG
// Plain files, so a drawing can be inspected by hand and deleted by deleting its folder.
// scripts/seed-drawings.mjs writes this same layout; keep the two in sync.

/** drawing.json: a version's details without its SVG, which lives in its own file. */
interface StoredDrawing {
  id: string;
  title: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  versions: Omit<DrawingVersion, "svg">[];
}

/** What a newly drawn version brings with it. */
export interface NewVersion {
  /** The drawing to add to. Missing, invalid or deleted means a new drawing is started. */
  drawingId?: unknown;
  description: string;
  svg: string;
  kind: VersionKind;
  change?: string;
}

// Ids come from randomUUID(). Checking the exact shape also keeps an id from the
// renderer, like "../../somewhere", from ever reaching a file path.
const ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export function isDrawingId(id: unknown): id is string {
  return typeof id === "string" && ID_PATTERN.test(id);
}

function drawingsDir(): string {
  return join(app.getPath("userData"), "drawings");
}

function drawingDir(id: string): string {
  return join(drawingsDir(), id);
}

/**
 * Saves a freshly drawn version and returns where it went. A failed write is logged rather
 * than thrown, so a diagram the user already paid for still shows up in the panel.
 */
export async function addVersion(
  input: NewVersion,
): Promise<{ drawingId: string; version: number }> {
  const existing = isDrawingId(input.drawingId)
    ? await readMeta(input.drawingId)
    : null;
  const now = new Date().toISOString();

  const meta: StoredDrawing = existing ?? {
    id: randomUUID(),
    title: titleFrom(input.svg) ?? shorten(input.description),
    description: input.description,
    createdAt: now,
    updatedAt: now,
    versions: [],
  };

  const version = meta.versions.length + 1;
  meta.versions.push({
    number: version,
    kind: existing ? input.kind : "first",
    ...(input.change ? { change: input.change } : {}),
    createdAt: now,
    inserted: false,
  });
  meta.updatedAt = now;

  try {
    await mkdir(drawingDir(meta.id), { recursive: true });
    await writeFile(
      join(drawingDir(meta.id), `v${version}.svg`),
      input.svg,
      "utf8",
    );
    await writeMeta(meta);
  } catch (error) {
    console.error("[picasso] couldn't save the drawing:", error);
  }
  return { drawingId: meta.id, version };
}

/** Marks a version as inserted into notes (the green Draw button). */
export async function markInserted(id: string, version: number): Promise<void> {
  const meta = await readMeta(id);
  const entry = meta?.versions.find((v) => v.number === version);
  if (!meta || !entry || entry.inserted) return;
  entry.inserted = true;
  await writeMeta(meta);
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
      const latest = meta?.versions[meta.versions.length - 1];
      if (!meta || !latest) return null;
      const latestSvg = await readSvg(id, latest.number);
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

  const versions: DrawingVersion[] = [];
  for (const entry of meta.versions) {
    const svg = await readSvg(id, entry.number);
    if (svg !== null) versions.push({ ...entry, svg });
  }
  return { ...meta, versions };
}

export async function deleteDrawing(id: string): Promise<void> {
  await rm(drawingDir(id), { recursive: true, force: true });
}

async function readMeta(id: string): Promise<StoredDrawing | null> {
  try {
    const meta = JSON.parse(
      await readFile(join(drawingDir(id), "drawing.json"), "utf8"),
    ) as StoredDrawing;
    return Array.isArray(meta.versions) ? meta : null;
  } catch {
    return null; // missing or damaged
  }
}

/** Writes to a temporary file first, so a crash mid-write can't leave half a drawing.json. */
async function writeMeta(meta: StoredDrawing): Promise<void> {
  const file = join(drawingDir(meta.id), "drawing.json");
  await writeFile(`${file}.tmp`, JSON.stringify(meta, null, 2), "utf8");
  await rename(`${file}.tmp`, file);
}

async function readSvg(id: string, version: number): Promise<string | null> {
  try {
    return await readFile(join(drawingDir(id), `v${version}.svg`), "utf8");
  } catch {
    return null;
  }
}

/** The diagram's name from its hidden <title> element, which the system prompt asks Claude for. */
function titleFrom(svg: string): string | null {
  const match = /<title[^>]*>([^<]{1,200})<\/title>/i.exec(svg);
  if (!match) return null;
  const title = decodeEntities(match[1]).replace(/\s+/g, " ").trim();
  return title ? title.slice(0, 80) : null;
}

/** Fallback title: the start of what the student typed. */
function shorten(description: string): string {
  const text = description.replace(/\s+/g, " ").trim();
  return text.length > 60 ? `${text.slice(0, 57)}…` : text;
}

function decodeEntities(text: string): string {
  return text
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, "&");
}
