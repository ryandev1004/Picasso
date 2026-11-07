<script setup lang="ts">
import { ref } from "vue";
import type { Drawing, DrawingVersion } from "@shared/ipc";
import { formatWhen } from "@renderer/lib/dates";
import { svgDataUrl, svgToPng } from "@renderer/lib/svgImage";

const props = defineProps<{ drawing: Drawing }>();

const copied = ref<number | null>(null); // which version's Copy button says "Copied"
const error = ref("");

/** What led to each version: the first description, the change asked for, or a retry. */
function describe(version: DrawingVersion): string {
  if (version.kind === "edit" && version.change) return `“${version.change}”`;
  if (version.kind === "retry") return "Drawn again from scratch";
  return `“${props.drawing.description}”`;
}

/** Copies one version as an image, ready to paste into notes with Ctrl+V. */
async function copy(version: DrawingVersion): Promise<void> {
  error.value = "";
  try {
    const result = await window.picasso.copyImage(await svgToPng(version.svg));
    if (!result.ok) {
      error.value = result.error;
      return;
    }
    copied.value = version.number;
    setTimeout(() => {
      if (copied.value === version.number) copied.value = null;
    }, 1500);
  } catch (err) {
    console.error("[picasso] couldn't turn the diagram into a PNG:", err);
    error.value = "Couldn't turn that diagram into an image.";
  }
}
</script>

<template>
  <p v-if="error" class="error">{{ error }}</p>

  <!-- Oldest first, so it reads like the conversation that made the drawing. -->
  <ol class="thread">
    <li v-for="version in drawing.versions" :key="version.number">
      <div class="meta">
        <span class="badge">v{{ version.number }}</span>
        <span class="what">{{ describe(version) }}</span>
        <span class="when">{{ formatWhen(version.createdAt) }}</span>
        <span v-if="version.inserted" class="inserted">Inserted</span>
        <button
          class="btn copy"
          title="Copy as an image, then paste with Ctrl+V"
          @click="copy(version)"
        >
          {{ copied === version.number ? "Copied" : "Copy" }}
        </button>
      </div>
      <!-- An edit made by drawing on the diagram: show what was marked, then the result. -->
      <figure v-if="version.marksSvg" class="marks">
        <figcaption>Your marks on v{{ version.number - 1 }}</figcaption>
        <img
          :src="svgDataUrl(version.marksSvg)"
          :alt="`Your marks on version ${version.number - 1}`"
        />
      </figure>
      <div class="preview">
        <img
          :src="svgDataUrl(version.svg)"
          :alt="`${drawing.title}, version ${version.number}`"
        />
      </div>
    </li>
  </ol>
</template>

<style scoped>
.error {
  margin: 0 0 16px;
  color: var(--danger);
  font-size: 13px;
}

.marks {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  margin: 0 0 10px;
  padding: 10px 12px;
  border: 1px dashed var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-soft);
}

.marks figcaption {
  flex-shrink: 0;
  width: 110px;
  color: var(--text-muted);
  font-size: 13px;
}

.marks img {
  display: block;
  min-width: 0;
  max-width: 100%;
  max-height: 160px;
  object-fit: contain;
}

.thread {
  display: flex;
  flex-direction: column;
  gap: 28px;
  margin: 0;
  padding: 0;
  list-style: none;
}

.meta {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.badge {
  flex-shrink: 0;
  padding: 0 8px;
  border-radius: 999px;
  background: var(--badge);
  color: #ffffff;
  font-size: 12px;
}

.what {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.when {
  flex-shrink: 0;
  color: var(--text-faint);
  font-size: 13px;
}

.inserted {
  flex-shrink: 0;
  padding: 0 8px;
  border-radius: 999px;
  background: #e3efe5;
  color: var(--accent);
  font-size: 12px;
}

.copy {
  flex-shrink: 0;
  margin-left: auto;
  padding: 3px 12px;
  font-size: 13px;
}

.preview {
  display: flex;
  justify-content: center;
  padding: 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
}

.preview img {
  display: block;
  max-width: 100%;
  max-height: 320px;
  object-fit: contain;
}
</style>
