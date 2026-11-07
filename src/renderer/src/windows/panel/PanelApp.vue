<script setup lang="ts">
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  useTemplateRef,
  watch,
} from "vue";
import type { DrawResult, PasteTarget } from "@shared/ipc";
import { svgDataUrl, svgToPng } from "@renderer/lib/svgImage";
import { plural } from "@renderer/lib/format";
import MarkupLayer from "./MarkupLayer.vue";
import PencilLoader from "./PencilLoader.vue";
import { markedPicture, type Mark, type Tool } from "./marks";

/** The version on screen, and where main saved it in history. */
interface Shown {
  svg: string;
  drawingId: string;
  version: number; // the "v" badge
}

const input = ref(""); // the text box at the bottom
const request = ref(""); // the first description, shown above the preview
const changes = ref<string[]>([]); // every "What should change?" that has been drawn
const current = ref<Shown | null>(null); // null until the first drawing arrives
const busy = ref<"" | "drawing" | "copying">("");
const error = ref("");
const promptInput = useTemplateRef<HTMLInputElement>("prompt-input");
// The window the panel was opened from, where Draw pastes (null: opened from Picasso itself).
const target = ref<PasteTarget | null>(null);

const TOOLS: { tool: Tool; label: string; title: string }[] = [
  { tool: "pen", label: "Pen", title: "Draw freehand to circle or underline" },
  { tool: "arrow", label: "Arrow", title: "Drag to draw an arrow" },
  { tool: "erase", label: "Erase", title: "Wipe over a mark to remove it" },
];
const tool = ref<Tool>("pen");
const marks = ref<Mark[]>([]); // red marks drawn on the version on screen

const hasDrawing = computed(() => current.value !== null);
const isBusy = computed(() => busy.value !== "");
// Encoded once per version, not on every keystroke in the text box.
const previewUrl = computed(() =>
  current.value ? svgDataUrl(current.value.svg) : "",
);

// Marks belong to the version they were drawn on, so a new version (or New) clears them.
watch(
  () => current.value?.svg,
  () => {
    marks.value = [];
  },
);

/** Marks only point at things; Redraw needs a note saying what to do with them. */
const needsNote = computed(
  () => marks.value.length > 0 && input.value.trim() === "",
);

/** Whether Generate/Redraw can run: not busy, no marks waiting for a note, something to send. */
const canSubmit = computed(
  () =>
    !isBusy.value &&
    !needsNote.value &&
    (hasDrawing.value || input.value.trim() !== ""),
);

/** The grey hint next to Pen / Arrow / Erase. */
const toolHint = computed(() => {
  if (marks.value.length === 0)
    return "Draw on the preview to point at changes";
  const what = plural(marks.value.length, "mark");
  return needsNote.value
    ? `${what} · now type what should change`
    : `${what} · Redraw sends them with your change`;
});

/** The footer's note about what Draw will do. */
const footerNote = computed(() => {
  if (!target.value) return "Copies to your clipboard";
  if (target.value.images === "no") {
    return `${target.value.app} can't take images. Draw copies instead.`;
  }
  return "Inserts at your cursor";
});

function focusInput(): void {
  promptInput.value?.focus();
  promptInput.value?.select();
}

function onShown(shownFor: PasteTarget | null): void {
  target.value = shownFor;
  focusInput();
}

function hide(): void {
  window.picasso.hidePanel();
}

/** Back to an empty panel, ready for the next diagram. */
function reset(): void {
  input.value = "";
  request.value = "";
  changes.value = [];
  current.value = null;
  error.value = "";
}

/** A fresh drawing ("try again") still includes every change asked for so far. */
function buildPrompt(text: string, edits: string[]): string {
  if (edits.length === 0) return text;
  return `${text}\n\nChanges to make:\n${edits.map((edit) => `- ${edit}`).join("\n")}`;
}

/** Runs one request to Claude (main also saves the result). Returns whether it worked. */
async function draw(send: () => Promise<DrawResult>): Promise<boolean> {
  busy.value = "drawing";
  error.value = "";
  let result: DrawResult;
  try {
    result = await send();
  } catch (err) {
    console.error("[picasso] couldn't send the request:", err);
    result = { ok: false, error: "Something went wrong. Try again." };
  }
  busy.value = "";

  if (!result.ok) {
    error.value = result.error;
    return false;
  }
  current.value = {
    svg: result.svg,
    drawingId: result.drawingId,
    version: result.version,
  };
  return true;
}

/** The text box's button: Generate before there's a drawing, then Redraw. */
async function submit(): Promise<void> {
  if (!canSubmit.value) {
    if (needsNote.value) focusInput(); // marks are waiting for a note (the hint says so)
    return;
  }
  const text = input.value.trim();
  if (!current.value) return generate(text);
  await (text ? redraw(current.value, text) : retry(current.value.drawingId));
  focusInput();
}

/** The first drawing, from what was typed. */
async function generate(text: string): Promise<void> {
  request.value = text; // shown above the preview while it's drawn
  if (await draw(() => window.picasso.generateDiagram(text))) input.value = "";
  else request.value = "";
}

/** An empty Redraw: a fresh drawing of the request and its changes so far. */
async function retry(drawingId: string): Promise<void> {
  const prompt = buildPrompt(request.value, changes.value);
  await draw(() => window.picasso.generateDiagram(prompt, drawingId));
}

/** A Redraw with a change: Claude edits the diagram on screen, guided by any marks. */
async function redraw(on: Shown, change: string): Promise<void> {
  const drawn = marks.value;
  const sent = await draw(async () =>
    window.picasso.redrawDiagram({
      description: request.value,
      svg: on.svg,
      change,
      drawingId: on.drawingId,
      // Claude sees a picture of the diagram with the marks on top.
      marks: drawn.length > 0 ? await markedPicture(on.svg, drawn) : undefined,
    }),
  );
  if (sent) {
    changes.value = [...changes.value, change];
    input.value = "";
  }
}

/** The green Draw button: main copies the image, hides the panel, and pastes it where you were typing. */
async function approve(): Promise<void> {
  const shown = current.value;
  if (!shown || isBusy.value) return;

  busy.value = "copying";
  error.value = "";
  try {
    const result = await window.picasso.approveDiagram(
      await svgToPng(shown.svg),
      shown.drawingId,
      shown.version,
    );
    if (result.ok) reset();
    else error.value = result.error;
  } catch (err) {
    console.error("[picasso] couldn't turn the diagram into a PNG:", err);
    error.value = "Couldn't turn the diagram into an image. Try Redraw.";
  } finally {
    busy.value = "";
  }
}

function startOver(): void {
  reset();
  focusInput();
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") hide();
  if (event.key === "Enter" && event.ctrlKey) {
    event.preventDefault(); // otherwise Enter also submits the text box
    approve();
  }
}

let stopListening: (() => void) | undefined;

onMounted(() => {
  stopListening = window.picasso.onPanelShown(onShown);
  window.addEventListener("keydown", onKeydown);
});

onUnmounted(() => {
  stopListening?.();
  window.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <div class="panel">
    <div class="body">
      <header class="titlebar">
        <span class="brand">Picasso</span>
        <span v-if="target" class="into truncate" :title="target.title">
          into {{ target.title }}
        </span>
        <span class="spacer" />
        <button
          v-if="request && !isBusy"
          class="start-over"
          title="Clear this drawing"
          @click="startOver"
        >
          New
        </button>
        <button class="esc" title="Hide (Esc)" @click="hide">
          <kbd>esc</kbd>
        </button>
      </header>

      <p v-if="request" class="request" :title="request">{{ request }}</p>

      <section
        class="preview"
        :class="{ stripes: !current, drawing: busy === 'drawing' }"
      >
        <template v-if="current">
          <img :src="previewUrl" :alt="`Diagram: ${request}`" />
          <MarkupLayer
            v-model="marks"
            :svg="current.svg"
            :tool="tool"
            :disabled="isBusy"
          />
          <span class="badge version-badge">v{{ current.version }}</span>
        </template>

        <PencilLoader
          v-if="busy === 'drawing'"
          class="loader"
          :caption="current ? 'Redrawing…' : 'Drawing…'"
        />
        <span v-else-if="!current" class="label">
          describe a diagram below
        </span>
      </section>

      <div class="tools">
        <div class="segmented">
          <button
            v-for="option in TOOLS"
            :key="option.tool"
            :class="{ active: tool === option.tool }"
            :disabled="!hasDrawing || isBusy"
            :title="option.title"
            @click="tool = option.tool"
          >
            {{ option.label }}
          </button>
        </div>
        <span class="hint" :class="{ waiting: needsNote }">{{ toolHint }}</span>
      </div>

      <p v-if="error" class="error-text panel-error">{{ error }}</p>

      <form class="ask" @submit.prevent="submit">
        <input
          ref="prompt-input"
          v-model="input"
          :placeholder="
            hasDrawing ? 'What should change?' : 'What should Picasso draw?'
          "
          :disabled="isBusy"
        />
        <button type="submit" class="btn" :disabled="!canSubmit">
          {{ hasDrawing ? "Redraw" : "Generate" }}
        </button>
      </form>
    </div>

    <footer class="footer">
      <span class="footer-note">{{ footerNote }}</span>
      <button
        class="btn-primary"
        :disabled="!hasDrawing || isBusy"
        @click="approve"
      >
        Draw <span class="shortcut">Ctrl ↵</span>
      </button>
    </footer>
  </div>
</template>

<style scoped>
.panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--surface);
}

.body {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 12px 16px 16px;
}

.titlebar {
  display: flex;
  align-items: center;
  gap: 8px;
  height: 26px;
  font-size: 17px;
  /* Frameless window: this bar is what you grab to drag it around. */
  -webkit-app-region: drag;
  user-select: none;
}

.into {
  min-width: 0;
  color: var(--text-muted);
  font-size: 13px;
}

.spacer {
  flex: 1;
}

.start-over,
.esc {
  -webkit-app-region: no-drag;
  padding: 0;
  border: none;
  background: none;
  line-height: 1;
}

.start-over {
  padding: 3px 8px;
  border-radius: 6px;
  color: var(--text-muted);
  font-size: 13px;
}

.start-over:hover {
  background: var(--fill-soft);
  color: var(--text);
}

.esc kbd {
  padding: 3px 7px;
}

.esc:hover kbd {
  color: var(--text);
}

.request {
  display: -webkit-box;
  margin: -2px 0 0;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  line-clamp: 2;
}

/* The preview centers its contents, so the absolutely placed loader and label sit in the middle. */
.preview {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background-color: var(--surface);
}

.preview img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
  transition: opacity 0.2s;
}

/* While redrawing, fade the old version behind the pencil. */
.preview.drawing img {
  opacity: 0.3;
}

.version-badge {
  position: absolute;
  top: 10px;
  left: 10px;
}

.loader,
.label {
  position: absolute;
}

.label {
  padding: 2px 8px;
  border-radius: 4px;
  background: color-mix(in srgb, var(--bg) 90%, transparent);
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 12.5px;
}

.tools {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.tools .segmented {
  background: var(--fill-soft);
}

.hint {
  color: var(--text-muted);
  font-size: 13px;
  text-align: right;
}

.hint.waiting {
  color: var(--hint);
}

.panel-error {
  margin: -4px 0 0;
}

.ask {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 5px 5px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-soft);
}

.ask:focus-within {
  border-color: var(--border-strong);
}

.ask input {
  flex: 1;
  min-width: 0;
  padding: 4px 0;
  border: none;
  background: transparent;
  outline: none;
  font-size: 15px;
}

.ask input::placeholder {
  color: var(--text-muted);
}

.footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 10px 16px;
  border-top: 1px solid var(--border);
  background: var(--surface-soft);
}

.footer-note {
  color: var(--text-muted);
  font-size: 13px;
}

.shortcut {
  font-size: 12px;
  opacity: 0.75;
}
</style>
