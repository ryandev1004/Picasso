<script setup lang="ts">
import { ref } from "vue";
import HomeView from "./HomeView.vue";
import SettingsView from "./SettingsView.vue";

// Two screens is too few for a router; a ref that picks one is enough.
const view = ref<"home" | "settings">("home");
</script>

<template>
  <div class="app">
    <nav class="tabs">
      <button :class="{ active: view === 'home' }" @click="view = 'home'">Home</button>
      <button :class="{ active: view === 'settings' }" @click="view = 'settings'">Settings</button>
    </nav>

    <HomeView v-if="view === 'home'" />
    <SettingsView v-else />
  </div>
</template>

<style scoped>
.app {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.tabs {
  display: flex;
  gap: 4px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
}

.tabs button {
  padding: 6px 12px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  font-weight: 500;
}

.tabs button:hover,
.tabs button.active {
  background: var(--surface);
  color: var(--text);
}

.tabs button.active {
  box-shadow: 0 0 0 1px var(--border);
}
</style>
