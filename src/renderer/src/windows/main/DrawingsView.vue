<script setup lang="ts">
import type { AppInfo } from "@shared/ipc";

defineProps<{ info: AppInfo | null }>();
</script>

<template>
  <main class="drawings">
    <div class="content">
      <h1>All drawings</h1>

      <!-- Nothing is saved until history exists (M7), so this placeholder card stands in for the grid. -->
      <section class="grid">
        <article class="card">
          <div class="thumb stripes">
            <span class="thumb-label">your first drawing</span>
          </div>
          <h2 class="card-title">No drawings yet</h2>
          <p v-if="info" class="card-sub">
            Press {{ info.hotkey }} anywhere to make one.
          </p>
        </article>
      </section>

      <p v-if="info && !info.hotkeyActive" class="warning">
        Another app is already using {{ info.hotkey }}, so it won't open Picasso
        right now. Change <code>PANEL_HOTKEY</code> in
        <code>src/main/shortcuts.ts</code>.
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

h1 {
  margin: 0;
  font-family: var(--font-serif);
  font-size: 36px;
  font-weight: 400;
  line-height: 1.2;
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 24px 20px;
  margin-top: 32px;
}

.thumb {
  display: flex;
  align-items: center;
  justify-content: center;
  aspect-ratio: 16 / 10;
  border: 1px solid var(--border);
  border-radius: 10px;
}

.thumb-label {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 12px;
}

.card-title {
  margin: 10px 0 0;
  font-size: 14px;
  font-weight: 400;
}

.card-sub {
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
