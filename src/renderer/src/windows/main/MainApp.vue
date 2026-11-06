<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from "vue";
import type { AppInfo, DrawingSummary } from "@shared/ipc";
import DrawingList from "./DrawingList.vue";
import DrawingsView from "./DrawingsView.vue";
import SettingsView from "./SettingsView.vue";

// Two screens is too few for a router; a ref that picks one is enough.
const view = ref<"drawings" | "settings">("drawings");
const info = ref<AppInfo | null>(null);
const hotkeyKeys = computed(() => info.value?.hotkey.split("+") ?? []);

const drawings = ref<DrawingSummary[]>([]); // everything saved, newest first
const loaded = ref(false);
const query = ref("");
const selectedId = ref<string | null>(null);
// With a drawing open: its versions ("thread") or the grid of everything ("all").
const mode = ref<"thread" | "all">("all");

/** Drawings whose title or description contains every word typed in Search. */
const filtered = computed(() => {
  const words = query.value.toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return drawings.value;
  return drawings.value.filter((d) => {
    const text = `${d.title} ${d.description}`.toLowerCase();
    return words.every((word) => text.includes(word));
  });
});

/** Reloads the list. Runs at start and whenever a drawing is added, changed or deleted. */
async function loadDrawings(): Promise<void> {
  drawings.value = await window.picasso.listDrawings();
  loaded.value = true;
  // The open drawing was deleted: go back to the grid.
  if (
    selectedId.value &&
    !drawings.value.some((d) => d.id === selectedId.value)
  ) {
    selectedId.value = null;
    mode.value = "all";
  }
}

/** Opens a drawing's thread (from the sidebar or a grid card). */
function select(id: string): void {
  selectedId.value = id;
  mode.value = "thread";
  view.value = "drawings";
}

function newDrawing(): void {
  window.picasso.togglePanel();
}

let stopListening: (() => void) | undefined;

onMounted(async () => {
  // Drawings made in the panel show up here right away.
  stopListening = window.picasso.onDrawingsChanged(loadDrawings);
  info.value = await window.picasso.getAppInfo();
  await loadDrawings();
});

onUnmounted(() => stopListening?.());
</script>

<template>
  <div class="app">
    <!-- The title bar is hidden, so this strip is what you grab to move the window. -->
    <div class="drag-area" />

    <aside class="sidebar">
      <div class="brand logo">Picasso</div>

      <button class="new-drawing" @click="newDrawing">
        New drawing
        <span class="keys">{{ hotkeyKeys.join(" ") }}</span>
      </button>

      <input
        v-model="query"
        class="search"
        type="search"
        placeholder="Search drawings"
        spellcheck="false"
      />

      <DrawingList
        class="list"
        :drawings="filtered"
        :selected-id="view === 'drawings' ? selectedId : null"
        :searching="query.trim() !== ''"
        :loaded="loaded"
        @select="select"
      />

      <button
        class="nav-item"
        :class="{ active: view === 'settings' }"
        @click="view = 'settings'"
      >
        Settings
      </button>
    </aside>

    <DrawingsView
      v-if="view === 'drawings'"
      v-model:mode="mode"
      :drawings="filtered"
      :total="drawings.length"
      :loaded="loaded"
      :selected-id="selectedId"
      :query="query.trim()"
      :info="info"
      @select="select"
    />
    <SettingsView v-else :info="info" @back="view = 'drawings'" />
  </div>
</template>

<style scoped>
.app {
  height: 100%;
  display: flex;
}

/* Spans the top of the window. Windows draws its buttons over the right end of it. */
.drag-area {
  position: fixed;
  inset: 0 0 auto;
  z-index: 10;
  height: env(titlebar-area-height, 36px);
  -webkit-app-region: drag;
}

.sidebar {
  flex-shrink: 0;
  width: 264px;
  display: flex;
  flex-direction: column;
  padding: 18px 14px 14px;
  border-right: 1px solid var(--border);
  background: var(--sidebar);
}

.logo {
  --brand-dot: 20px;
  margin: 0 4px 20px;
  font-size: 21px;
}

.new-drawing {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  height: 36px;
  padding: 0 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: 0 1px 2px rgb(0 0 0 / 0.03);
}

.new-drawing:hover {
  background: var(--surface-soft);
}

.keys {
  color: var(--text-faint);
  font-size: 12px;
}

.search {
  flex-shrink: 0;
  height: 31px;
  margin-top: 20px;
  padding: 0 12px;
  border: 1px solid transparent;
  border-radius: var(--radius);
  background: var(--fill);
  outline: none;
}

.search:focus {
  border-color: #d6cfc6;
}

.search::placeholder {
  color: var(--text-muted);
}

/* The list scrolls on its own, so New drawing, Search and Settings stay put. */
.list {
  flex: 1;
  min-height: 0;
  margin: 8px -4px 8px;
  padding: 0 4px;
  overflow-y: auto;
}

.nav-item {
  flex-shrink: 0;
  padding: 7px 12px;
  border: none;
  border-radius: var(--radius);
  background: transparent;
  color: var(--text-muted);
  text-align: left;
}

.nav-item:hover,
.nav-item.active {
  background: var(--fill-strong);
  color: var(--text);
}
</style>
