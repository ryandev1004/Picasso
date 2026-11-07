<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { AppInfo, Drawing, DrawingSummary } from "@shared/ipc";
import { formatWhen, versionLabel } from "@renderer/lib/dates";
import DrawingGrid from "./DrawingGrid.vue";
import ThreadView from "./ThreadView.vue";

const props = defineProps<{
  drawings: DrawingSummary[]; // already narrowed by Search
  total: number; // how many are saved in all
  loaded: boolean;
  selectedId: string | null;
  query: string;
  info: AppInfo | null;
}>();
const mode = defineModel<"thread" | "all">("mode", { required: true });
defineEmits<{ select: [id: string] }>();

/** The open drawing with every version. Reloads when another is picked or the list changes. */
const selected = ref<Drawing | null>(null);
watch(
  () => [props.selectedId, props.drawings] as const,
  async ([id]) => {
    const drawing = id ? await window.picasso.getDrawing(id) : null;
    if (props.selectedId === id) selected.value = drawing; // ignore an answer that arrived late
  },
  { immediate: true },
);

const countLabel = computed(() =>
  props.total === 1 ? "1 drawing" : `${props.total} drawings`,
);

// Delete takes two clicks, so one stray click can't throw a drawing away.
const confirmingDelete = ref(false);
let confirmTimer: ReturnType<typeof setTimeout> | undefined;

watch(
  () => props.selectedId,
  () => {
    confirmingDelete.value = false;
  },
);

async function remove(): Promise<void> {
  if (!selected.value) return;
  if (!confirmingDelete.value) {
    confirmingDelete.value = true;
    clearTimeout(confirmTimer);
    confirmTimer = setTimeout(() => (confirmingDelete.value = false), 3000);
    return;
  }
  clearTimeout(confirmTimer);
  confirmingDelete.value = false;
  // MainApp reloads the list when main reports the change, and closes the deleted drawing.
  await window.picasso.deleteDrawing(selected.value.id);
}
</script>

<template>
  <main class="drawings">
    <div class="content">
      <header class="header">
        <div class="heading">
          <h1>{{ selected ? selected.title : "All drawings" }}</h1>
          <div v-if="selected" class="chips">
            <span class="chip">{{ formatWhen(selected.updatedAt) }}</span>
            <span class="chip">{{
              versionLabel(selected.versions.length)
            }}</span>
            <button
              class="delete"
              :class="{ confirming: confirmingDelete }"
              @click="remove"
            >
              {{ confirmingDelete ? "Click again to delete" : "Delete" }}
            </button>
          </div>
          <div v-else-if="total > 0" class="chips">
            <span class="chip">{{ countLabel }}</span>
          </div>
        </div>

        <div v-if="selected" class="segmented toggle">
          <button
            :class="{ active: mode === 'thread' }"
            @click="mode = 'thread'"
          >
            Thread
          </button>
          <button :class="{ active: mode === 'all' }" @click="mode = 'all'">
            All drawings
          </button>
        </div>
      </header>

      <section class="body">
        <ThreadView v-if="selected && mode === 'thread'" :drawing="selected" />

        <DrawingGrid
          v-else-if="drawings.length > 0"
          :drawings="drawings"
          :selected-id="selectedId"
          @select="$emit('select', $event)"
        />

        <p v-else-if="total > 0" class="no-results">
          No drawings match “{{ query }}”.
        </p>

        <!-- Nothing saved yet: a placeholder card where the grid will be. -->
        <div v-else-if="loaded" class="placeholder-grid">
          <article class="placeholder">
            <div class="placeholder-thumb stripes">
              <span class="placeholder-label">your first drawing</span>
            </div>
            <h2 class="placeholder-title">No drawings yet</h2>
            <p v-if="info" class="placeholder-sub">
              Press {{ info.hotkey }} anywhere to make one.
            </p>
          </article>
        </div>
      </section>

      <p v-if="info && !info.hotkeyActive" class="warning">
        Another app is already using {{ info.hotkey }}, so it won't open Picasso
        right now. Change <code>PANEL_HOTKEY</code> in
        <code>src/main/system/shortcuts.ts</code>.
      </p>
    </div>
  </main>
</template>

<style scoped>
.drawings {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
}

.content {
  max-width: 864px;
  margin: 0 auto;
  /* Extra room on top so the title clears the window buttons. */
  padding: 48px 40px 36px;
}

.header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
}

.heading {
  min-width: 0;
}

h1 {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 36px;
  font-weight: 400;
  line-height: 1.2;
  overflow-wrap: anywhere;
}

.chips {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-top: 10px;
}

.delete {
  padding: 1px 8px;
  border: none;
  border-radius: 999px;
  background: none;
  color: var(--text-faint);
  font-size: 13px;
}

.delete:hover {
  color: var(--danger);
}

.delete.confirming {
  background: #f6e3df;
  color: var(--danger);
}

.toggle {
  flex-shrink: 0;
}

.body {
  margin-top: 32px;
}

.no-results {
  color: var(--text-muted);
}

.placeholder-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 24px 20px;
}

.placeholder-thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 16 / 10;
  border: 1px solid var(--border);
  border-radius: 10px;
}

.placeholder-label {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 12px;
}

.placeholder-title {
  margin: 10px 0 0;
  font-size: 14px;
  font-weight: 400;
}

.placeholder-sub {
  margin: 0;
  color: var(--text-muted);
  font-size: 13px;
}

.warning {
  max-width: 480px;
  margin: 32px 0 0;
  padding: 8px 12px;
  border: 1px solid var(--warning);
  border-radius: var(--radius);
  color: var(--warning);
  font-size: 13px;
}
</style>
