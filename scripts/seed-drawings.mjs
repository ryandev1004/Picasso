// Fills Picasso's history with sample drawings dated today, yesterday, last week and earlier,
// so the main window's list, grouping, search and Thread view have something to show.
// Writes the same layout as src/main/storage/history.ts (keep the two in sync).
//
//   node scripts/seed-drawings.mjs            add the samples
//   node scripts/seed-drawings.mjs --remove   delete only the samples
//   --dir <path>                              use another drawings folder (default: %APPDATA%\picasso\drawings)
//
// Close Picasso first, or reopen the main window afterwards, so the list reloads.
import { randomUUID } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const args = process.argv.slice(2);
const dirFlag = args.indexOf("--dir");
const dir =
  dirFlag !== -1
    ? args[dirFlag + 1]
    : join(process.env.APPDATA ?? "", "picasso", "drawings");

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
const now = Date.now();
const startOfToday = new Date().setHours(0, 0, 0, 0);

const SAMPLES = [
  {
    title: "Krebs cycle, simplified",
    description:
      "Draw the Krebs cycle as a simple loop with the 8 steps labeled.",
    at: now - 10 * 60 * 1000,
    color: ["#e3eefa", "#1f5fa8"],
    versions: [
      { kind: "first" },
      { kind: "edit", change: "make it one continuous loop" },
      { kind: "edit", change: "label all 8 steps", inserted: true },
    ],
  },
  {
    title: "Supply & demand shift",
    description: "Supply and demand curves with demand shifting right.",
    at: now - 40 * 60 * 1000,
    color: ["#fbe8cf", "#a8641c"],
    versions: [{ kind: "first", inserted: true }],
  },
  {
    title: "TCP three-way handshake",
    description:
      "Sequence diagram of the TCP three-way handshake between a client and a server.",
    at: startOfToday - 6 * HOUR,
    color: ["#e3f1e6", "#3d834f"],
    versions: [{ kind: "first" }, { kind: "retry", inserted: true }],
  },
  {
    title: "Roman road network",
    description: "Simple map sketch of the main Roman roads out of Rome.",
    at: startOfToday - 9 * HOUR,
    color: ["#f1e7f7", "#7b4a9e"],
    versions: [{ kind: "first" }],
  },
  {
    title: "Binary search tree insert",
    description: "Insert 7 into the binary search tree 8, 3, 10, 1, 6, 14.",
    at: now - 4 * DAY,
    color: ["#e3eefa", "#1f5fa8"],
    versions: [
      { kind: "first" },
      { kind: "edit", change: "show where 7 goes in red", inserted: true },
    ],
  },
  {
    title: "Light-dependent reactions",
    description:
      "The light-dependent reactions of photosynthesis across the thylakoid membrane.",
    at: now - 6 * DAY,
    color: ["#e3f1e6", "#3d834f"],
    versions: [{ kind: "first" }],
  },
  {
    title: "Five-state process model",
    description:
      "The five-state process model with labeled transitions between states.",
    at: now - 20 * DAY,
    color: ["#fbe8cf", "#a8641c"],
    versions: [{ kind: "first", inserted: true }],
  },
];

const escape = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** A plain placeholder diagram: the title in a box, with the version underneath. */
function sampleSvg(title, [fill, stroke], version) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 250" width="400" height="250" font-family="system-ui, sans-serif">
<title>${escape(title)}</title>
<rect width="400" height="250" fill="#ffffff"/>
<rect x="40" y="70" width="320" height="110" rx="12" fill="${fill}" stroke="${stroke}" stroke-width="2"/>
<text x="200" y="120" text-anchor="middle" font-size="20" fill="#24211c">${escape(title)}</text>
<text x="200" y="150" text-anchor="middle" font-size="14" fill="#5f5a52">sample drawing · v${version}</text>
</svg>`;
}

async function addSamples() {
  for (const sample of SAMPLES) {
    const id = randomUUID();
    const folder = join(dir, id);
    await mkdir(folder, { recursive: true });

    // Versions are a few minutes apart, ending at the sample's time.
    const versions = sample.versions.map((v, i) => ({
      number: i + 1,
      kind: v.kind,
      ...(v.change ? { change: v.change } : {}),
      createdAt: new Date(
        sample.at - (sample.versions.length - 1 - i) * 3 * 60 * 1000,
      ).toISOString(),
      inserted: v.inserted ?? false,
    }));
    for (const v of versions) {
      await writeFile(
        join(folder, `v${v.number}.svg`),
        sampleSvg(sample.title, sample.color, v.number),
        "utf8",
      );
    }

    const meta = {
      id,
      title: sample.title,
      description: sample.description,
      createdAt: versions[0].createdAt,
      updatedAt: versions[versions.length - 1].createdAt,
      versions,
      sample: true, // lets --remove find these again
    };
    await writeFile(
      join(folder, "drawing.json"),
      JSON.stringify(meta, null, 2),
      "utf8",
    );
  }
  console.log(`Added ${SAMPLES.length} sample drawings to ${dir}`);
}

async function removeSamples() {
  let removed = 0;
  for (const id of await readdir(dir).catch(() => [])) {
    try {
      const meta = JSON.parse(
        await readFile(join(dir, id, "drawing.json"), "utf8"),
      );
      if (meta.sample === true) {
        await rm(join(dir, id), { recursive: true, force: true });
        removed++;
      }
    } catch {
      // not a drawing folder, or not readable: leave it alone
    }
  }
  console.log(`Removed ${removed} sample drawings from ${dir}`);
}

await (args.includes("--remove") ? removeSamples() : addSamples());
