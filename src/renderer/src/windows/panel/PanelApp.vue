<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, useTemplateRef } from "vue";
import type { DrawResult } from "@shared/ipc";
import { svgDataUrl, svgToPng } from "@renderer/lib/svgImage";

const input = ref(""); // the text box at the bottom
const request = ref(""); // the first description, shown above the preview
const changes = ref<string[]>([]); // every "What should change?" that has been drawn
const versions = ref<string[]>([]); // every SVG drawn for this request; the last one is shown
const drawingId = ref<string>(); // where main saves this drawing's versions in history
const versionNumber = ref(0); // the saved number of the version on screen (the "v" badge)
const busy = ref<"" | "drawing" | "copying">("");
const error = ref("");
const promptInput = useTemplateRef<HTMLInputElement>("prompt-input");

const latest = computed(() => versions.value[versions.value.length - 1]);
const hasDrawing = computed(() => versions.value.length > 0);

function focusInput(): void {
  promptInput.value?.focus();
  promptInput.value?.select();
}

function hide(): void {
  window.picasso.hidePanel();
}

/** Back to an empty panel, ready for the next diagram. */
function reset(): void {
  input.value = "";
  request.value = "";
  changes.value = [];
  versions.value = [];
  drawingId.value = undefined;
  versionNumber.value = 0;
  error.value = "";
}

/** A fresh drawing ("try again") still includes every change asked for so far. */
function buildPrompt(text: string, edits: string[]): string {
  if (edits.length === 0) return text;
  return `${text}\n\nChanges to make:\n${edits.map((edit) => `- ${edit}`).join("\n")}`;
}

/** Runs one request to Claude (main also saves the result). Returns whether a new version was added. */
async function draw(send: () => Promise<DrawResult>): Promise<boolean> {
  busy.value = "drawing";
  error.value = "";
  const result = await send();
  busy.value = "";

  if (!result.ok) {
    error.value = result.error;
    return false;
  }
  versions.value.push(result.svg);
  drawingId.value = result.drawingId;
  versionNumber.value = result.version;
  return true;
}

/** The text box's button: the first Generate, then Redraw. */
async function submit(): Promise<void> {
  if (busy.value) return;
  const text = input.value.trim();

  if (!hasDrawing.value) {
    if (!text) return;
    request.value = text;
    if (await draw(() => window.picasso.generateDiagram(text))) {
      input.value = "";
    } else {
      request.value = "";
    }
    return;
  }

  if (!text) {
    // An empty box means "try again": a fresh drawing of the request and its changes so far.
    const prompt = buildPrompt(request.value, changes.value);
    await draw(() => window.picasso.generateDiagram(prompt, drawingId.value));
  } else {
    // A change edits the diagram on screen, so only what was asked for moves.
    const current = {
      description: request.value,
      svg: latest.value,
      change: text,
      drawingId: drawingId.value,
    };
    if (await draw(() => window.picasso.redrawDiagram(current))) {
      changes.value = [...changes.value, text];
      input.value = "";
    }
  }
  focusInput();
}

/** The green Draw button: copy the latest version as an image, then main hides the panel. */
async function approve(): Promise<void> {
  const svg = latest.value;
  if (!svg || busy.value) return;

  busy.value = "copying";
  error.value = "";
  try {
    const result = await window.picasso.approveDiagram(
      await svgToPng(svg),
      drawingId.value,
      versionNumber.value,
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
  stopListening = window.picasso.onPanelShown(focusInput);
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
        <span class="spacer" />
        <button
          v-if="request && !busy"
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
        :class="{
          stripes: !latest,
          drawing: busy === 'drawing',
        }"
      >
        <img
          v-if="latest"
          :src="svgDataUrl(latest)"
          :alt="`Diagram: ${request}`"
        />
        <span v-if="hasDrawing" class="badge">v{{ versionNumber }}</span>

        <span v-if="busy === 'drawing'" class="label">
          {{ hasDrawing ? "Redrawing…" : "Drawing…" }}
        </span>
        <span v-else-if="!latest" class="label">
          describe a diagram below
        </span>
      </section>

      <!-- Drawing on the preview arrives in M6; the tools are shown but switched off until then. -->
      <div class="tools">
        <div class="segmented" title="Drawing on the preview is coming soon">
          <button class="active" disabled>Pen</button>
          <button disabled>Arrow</button>
          <button disabled>Erase</button>
        </div>
        <span class="hint">Drawing on the preview is coming soon</span>
      </div>

      <p v-if="error" class="error">{{ error }}</p>

      <form class="ask" @submit.prevent="submit">
        <input
          ref="prompt-input"
          v-model="input"
          :placeholder="
            hasDrawing ? 'What should change?' : 'What should Picasso draw?'
          "
          :disabled="busy !== ''"
        />
        <button
          type="submit"
          class="btn"
          :disabled="busy !== '' || (!hasDrawing && !input.trim())"
        >
          {{ hasDrawing ? "Redraw" : "Generate" }}
        </button>
      </form>
    </div>

    <footer class="footer">
      <!-- Until auto-paste exists, Draw copies the image and you press Ctrl+V. -->
      <span class="footer-note">Copies to your clipboard</span>
      <button
        class="btn-primary"
        :disabled="!hasDrawing || busy !== ''"
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

.preview.drawing img {
  opacity: 0.3;
}

/* Slide the stripes while Claude is drawing. */
.preview.drawing.stripes {
  animation: stripes 0.8s linear infinite;
}

@keyframes stripes {
  to {
    background-position: 28.28px 0;
  }
}

@media (prefers-reduced-motion: reduce) {
  .preview.drawing.stripes {
    animation: none;
  }
}

.badge {
  position: absolute;
  top: 10px;
  left: 10px;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--badge);
  color: #ffffff;
  font-size: 12px;
}

.label {
  position: absolute;
  padding: 2px 8px;
  border-radius: 4px;
  background: rgb(248 245 240 / 0.9);
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

.error {
  margin: -4px 0 0;
  color: var(--danger);
  font-size: 13px;
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
  border-color: #d6cfc6;
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
