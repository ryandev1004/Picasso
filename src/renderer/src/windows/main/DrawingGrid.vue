<script setup lang="ts">
import type { DrawingSummary } from "@shared/ipc";
import { formatDay } from "@renderer/lib/dates";
import { withVersions } from "@renderer/lib/format";
import { svgDataUrl } from "@renderer/lib/svgImage";

// The grid of thumbnail cards. With no drawings at all it shows one placeholder card,
// with `emptyHint` underneath, where the first drawing will go.
defineProps<{
  drawings: DrawingSummary[];
  selectedId: string | null;
  emptyHint?: string;
}>();
defineEmits<{ select: [id: string] }>();

// Turning an SVG into a data URL isn't free, and the grid re-renders on every Search
// keystroke, so each thumbnail's URL is kept until that drawing changes.
const thumbnails = new Map<string, string>();
function thumbnail(drawing: DrawingSummary): string {
  const key = `${drawing.id}@${drawing.updatedAt}`;
  let url = thumbnails.get(key);
  if (!url) {
    url = svgDataUrl(drawing.latestSvg);
    thumbnails.set(key, url);
  }
  return url;
}
</script>

<template>
  <section class="grid">
    <button
      v-for="drawing in drawings"
      :key="drawing.id"
      class="card"
      :class="{ active: drawing.id === selectedId }"
      @click="$emit('select', drawing.id)"
    >
      <span class="thumb">
        <img :src="thumbnail(drawing)" :alt="drawing.title" />
      </span>
      <span class="card-title truncate">{{ drawing.title }}</span>
      <span class="card-sub truncate">
        {{ withVersions(formatDay(drawing.updatedAt), drawing.versionCount) }}
      </span>
    </button>

    <article v-if="drawings.length === 0" class="card">
      <span class="thumb stripes">
        <span class="placeholder-label">your first drawing</span>
      </span>
      <span class="card-title">No drawings yet</span>
      <span v-if="emptyHint" class="card-sub">{{ emptyHint }}</span>
    </article>
  </section>
</template>

<style scoped>
.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 24px 20px;
}

.card {
  display: flex;
  flex-direction: column;
  min-width: 0;
  padding: 0;
  border: none;
  background: none;
  text-align: left;
}

.thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 16 / 10;
  padding: 8px;
  border: 1px solid var(--border);
  border-radius: 10px;
  transition: border-color 0.15s;
}

/* Scoped styles win over the global .stripes, so only plain thumbnails get the white. */
.thumb:not(.stripes) {
  background: var(--surface);
}

button.card:hover .thumb {
  border-color: var(--border-strong);
}

.card.active .thumb {
  border-color: var(--text-faint);
}

.thumb img {
  display: block;
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.placeholder-label {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 12px;
}

.card-title {
  margin-top: 10px;
}

.card-sub {
  color: var(--text-muted);
  font-size: 13px;
}
</style>
