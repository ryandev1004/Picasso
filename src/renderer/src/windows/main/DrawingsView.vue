<script setup lang="ts">
import { ref, watch } from "vue";
import type { AppInfo, Drawing, DrawingSummary } from "@shared/ipc";
import { formatWhen } from "@renderer/lib/dates";
import { plural } from "@renderer/lib/format";
import DrawingGrid from "./DrawingGrid.vue";
import ThreadView from "./ThreadView.vue";

const props = defineProps<{
  drawings: DrawingSummary[]; // already narrowed by Search
  total: number; // how many are saved in all
  loaded: boolean;
  revision: number; // goes up each time the saved drawings change
  selectedId: string | null;
  query: string;
  info: AppInfo | null;
}>();
const mode = defineModel<"thread" | "all">("mode", { required: true });
defineEmits<{ select: [id: string] }>();

/**
 * The open drawing with every version. Reloads when another is picked or history changes
 * (not on Search keystrokes, which only narrow the list).
 */
const selected = ref<Drawing | null>(null);
watch(
  [() => props.selectedId, () => props.revision],
  async ([id]) => {
    const drawing = id ? await window.picasso.getDrawing(id) : null;
    if (props.selectedId === id) selected.value = drawing; // ignore an answer that arrived late
  },
  { immediate: true },
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
  <main class="page">
    <div class="page-content">
      <header class="header">
        <div class="heading">
          <h1 class="page-title">
            {{ selected ? selected.title : "All drawings" }}
          </h1>
          <div v-if="selected" class="chips">
            <span class="chip">{{ formatWhen(selected.updatedAt) }}</span>
            <span class="chip">
              {{ plural(selected.versions.length, "version") }}
            </span>
            <button
              class="delete"
              :class="{ confirming: confirmingDelete }"
              @click="remove"
            >
              {{ confirmingDelete ? "Click again to delete" : "Delete" }}
            </button>
          </div>
          <div v-else-if="total > 0" class="chips">
            <span class="chip">{{ plural(total, "drawing") }}</span>
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

        <p v-else-if="drawings.length === 0 && total > 0" class="no-results">
          No drawings match “{{ query }}”.
        </p>

        <DrawingGrid
          v-else-if="loaded"
          :drawings="drawings"
          :selected-id="selectedId"
          :empty-hint="info ? `Press ${info.hotkey} anywhere to make one.` : ''"
          @select="$emit('select', $event)"
        />
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
.header {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 24px;
}

.heading {
  min-width: 0;
}

.page-title {
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
  background: var(--danger-soft);
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
