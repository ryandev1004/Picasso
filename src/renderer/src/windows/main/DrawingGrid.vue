<script setup lang="ts">
import type { DrawingSummary } from "@shared/ipc";
import { formatDay, versionLabel } from "@renderer/lib/dates";
import { svgDataUrl } from "@renderer/lib/svgImage";

defineProps<{ drawings: DrawingSummary[]; selectedId: string | null }>();
defineEmits<{ select: [id: string] }>();
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
        <img :src="svgDataUrl(drawing.latestSvg)" :alt="drawing.title" />
      </span>
      <span class="card-title">{{ drawing.title }}</span>
      <span class="card-sub">
        {{ formatDay(drawing.updatedAt) }}
        <template v-if="drawing.versionCount > 1">
          · {{ versionLabel(drawing.versionCount) }}
        </template>
      </span>
    </button>
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
  background: var(--surface);
  transition: border-color 0.15s;
}

.card:hover .thumb {
  border-color: #d6cfc6;
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

.card-title,
.card-sub {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.card-title {
  margin-top: 10px;
}

.card-sub {
  color: var(--text-muted);
  font-size: 13px;
}
</style>
