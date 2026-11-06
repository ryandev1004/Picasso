<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { AppInfo } from "@shared/ipc";
import DrawingsView from "./DrawingsView.vue";
import SettingsView from "./SettingsView.vue";

// Two screens is too few for a router; a ref that picks one is enough.
const view = ref<"drawings" | "settings">("drawings");
const info = ref<AppInfo | null>(null);
const hotkeyKeys = computed(() => info.value?.hotkey.split("+") ?? []);

onMounted(async () => {
  info.value = await window.picasso.getAppInfo();
});

function newDrawing(): void {
  window.picasso.togglePanel();
}
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

      <!-- Search and the drawing list come alive once drawings are saved (M7). -->
      <input class="search" placeholder="Search drawings" disabled />
      <p class="list-empty">Your drawings will show up here.</p>

      <button
        class="nav-item"
        :class="{ active: view === 'settings' }"
        @click="view = 'settings'"
      >
        Settings
      </button>
    </aside>

    <DrawingsView v-if="view === 'drawings'" :info="info" />
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
  height: 31px;
  margin-top: 20px;
  padding: 0 12px;
  border: none;
  border-radius: var(--radius);
  background: var(--fill);
  outline: none;
}

.search::placeholder {
  color: var(--text-muted);
}

.list-empty {
  margin: 20px 12px 0;
  color: var(--text-faint);
  font-size: 13px;
}

.nav-item {
  margin-top: auto;
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
