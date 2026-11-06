<script setup lang="ts">
import { computed, onMounted, ref } from "vue";
import type { AppInfo } from "@shared/ipc";

const info = ref<AppInfo | null>(null);
const hotkeyKeys = computed(() => info.value?.hotkey.split("+") ?? []);

onMounted(async () => {
  info.value = await window.picasso.getAppInfo();
});

function openPanel(): void {
  window.picasso.togglePanel();
}
</script>

<template>
  <main class="home">
    <h1>Picasso</h1>
    <p class="tagline">
      No time to draw during lecture? Describe it, and Picasso draws it.
    </p>

    <p v-if="info" class="hint">
      Press
      <template v-for="(key, i) in hotkeyKeys" :key="key">
        <kbd>{{ key }}</kbd
        ><span v-if="i < hotkeyKeys.length - 1"> + </span>
      </template>
      anywhere to open the quick-draw panel.
    </p>
    <p v-if="info && !info.hotkeyActive" class="warning">
      Another app is already using this shortcut, so it won't work right now.
      Change
      <code>PANEL_HOTKEY</code> in <code>src/main/shortcuts.ts</code>.
    </p>

    <button class="btn-primary" @click="openPanel">Open panel</button>

    <footer v-if="info" class="version">v{{ info.version }}</footer>
  </main>
</template>

<style scoped>
.home {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  padding: 24px;
  text-align: center;
}

h1 {
  margin: 0;
  font-size: 40px;
  letter-spacing: -0.02em;
}

.tagline {
  margin: 0;
  color: var(--text-muted);
}

.hint {
  margin: 16px 0 8px;
}

.warning {
  max-width: 420px;
  margin: 0 0 8px;
  padding: 8px 12px;
  border: 1px solid #d97706;
  border-radius: var(--radius);
  color: #d97706;
  font-size: 13px;
}

.version {
  position: fixed;
  bottom: 12px;
  color: var(--text-muted);
  font-size: 12px;
}
</style>
