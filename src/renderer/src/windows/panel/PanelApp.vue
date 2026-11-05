<script setup lang="ts">
import { onMounted, onUnmounted, ref, useTemplateRef } from "vue";

const prompt = ref("");
const lastPrompt = ref("");
const promptInput = useTemplateRef<HTMLInputElement>("prompt-input");

function focusInput(): void {
  promptInput.value?.focus();
  promptInput.value?.select();
}

function hide(): void {
  window.picasso.hidePanel();
}

function submit(): void {
  const text = prompt.value.trim();
  if (!text) return;
  // Later: send `text` to the main process, which calls the AI and returns a drawing.
  lastPrompt.value = text;
  prompt.value = "";
}

function onKeydown(event: KeyboardEvent): void {
  if (event.key === "Escape") hide();
}

let stopListening: (() => void) | undefined;

onMounted(() => {
  stopListening = window.picasso.onPanelShown(focusInput);
  window.addEventListener("keydown", onKeydown);
});

onUnmounted(() => {
  stopListening?.();
  window.removeEventListener("keydown", onKeydown);
});
</script>

<template>
  <div class="panel">
    <header class="titlebar">
      <span class="title">Picasso</span>
      <button class="close" title="Hide (Esc)" @click="hide">&times;</button>
    </header>

    <section class="canvas">
      <p v-if="lastPrompt">
        AI drawing isn't wired up yet.<br />
        You asked for: <strong>{{ lastPrompt }}</strong>
      </p>
      <p v-else class="empty">Describe something and it'll be drawn here.</p>
    </section>

    <form class="prompt" @submit.prevent="submit">
      <input
        ref="prompt-input"
        v-model="prompt"
        placeholder="A tree with its roots labeled…"
      />
      <button type="submit" class="btn-primary" :disabled="!prompt.trim()">
        Draw
      </button>
    </form>
  </div>
</template>

<style scoped>
.panel {
  height: 100%;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  background: var(--bg);
}

.titlebar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 36px;
  padding: 0 4px 0 12px;
  border-bottom: 1px solid var(--border);
  /* Frameless window: this bar is what you grab to drag it around. */
  -webkit-app-region: drag;
  user-select: none;
}

.title {
  font-weight: 600;
}

.close {
  -webkit-app-region: no-drag;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--text-muted);
  font-size: 18px;
  line-height: 1;
}

.close:hover {
  background: var(--border);
  color: var(--text);
}

.canvas {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 12px;
  padding: 16px;
  border: 1px dashed var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  text-align: center;
}

.empty {
  color: var(--text-muted);
}

.prompt {
  display: flex;
  gap: 8px;
  padding: 0 12px 12px;
}

.prompt input {
  flex: 1;
  min-width: 0;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  outline: none;
}

.prompt input:focus {
  border-color: var(--accent);
}
</style>
