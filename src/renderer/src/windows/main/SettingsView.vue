<script setup lang="ts">
import { onMounted, ref } from "vue";
import type { AppInfo } from "@shared/ipc";

defineProps<{ info: AppInfo | null }>();
defineEmits<{ back: [] }>();

const hasKey = ref(false);
const keyInput = ref("");
const saving = ref(false);
const error = ref("");

onMounted(async () => {
  hasKey.value = await window.picasso.hasApiKey();
});

async function save(): Promise<void> {
  saving.value = true;
  error.value = "";
  const result = await window.picasso.saveApiKey(keyInput.value);
  saving.value = false;

  if (!result.ok) {
    error.value = result.error;
    return;
  }
  keyInput.value = "";
  hasKey.value = true;
}

async function remove(): Promise<void> {
  await window.picasso.clearApiKey();
  hasKey.value = false;
}
</script>

<template>
  <main class="page">
    <div class="page-content">
      <header class="header">
        <h1 class="page-title">Settings</h1>
        <button class="btn" @click="$emit('back')">Back to drawings</button>
      </header>

      <section class="card">
        <h2>Claude API key</h2>
        <p class="muted">
          Picasso draws using your own Claude API key. It's encrypted with your
          Windows account and stored only on this PC.
        </p>

        <p class="chip status" :class="{ saved: hasKey }">
          {{ hasKey ? "Key saved" : "No key saved yet" }}
        </p>

        <form class="key-form" @submit.prevent="save">
          <input
            v-model="keyInput"
            type="password"
            autocomplete="off"
            spellcheck="false"
            :placeholder="hasKey ? 'Paste a new key to replace it' : 'sk-ant-…'"
          />
          <button
            type="submit"
            class="btn-primary"
            :disabled="!keyInput.trim() || saving"
          >
            Save
          </button>
        </form>
        <p v-if="error" class="error-text key-error">{{ error }}</p>

        <button v-if="hasKey" class="remove" @click="remove">Remove key</button>
      </section>

      <p v-if="info" class="version">Picasso v{{ info.version }}</p>
    </div>
  </main>
</template>

<style scoped>
.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 32px;
}

.card {
  max-width: 520px;
  padding: 18px 20px;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface);
}

h2 {
  margin: 0 0 4px;
  font-size: 15px;
  font-weight: 600;
}

.muted {
  margin: 0 0 12px;
  color: var(--text-muted);
  font-size: 13px;
}

.status {
  margin: 0 0 12px;
  font-size: 12px;
}

.status.saved {
  background: var(--accent-soft);
  color: var(--accent);
}

.key-form {
  display: flex;
  gap: 8px;
}

.key-form input {
  flex: 1;
  min-width: 0;
  padding: 6px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-soft);
  outline: none;
}

.key-form input:focus {
  border-color: var(--accent);
}

.key-error {
  margin: 8px 0 0;
}

.remove {
  margin-top: 12px;
  padding: 0;
  border: none;
  background: none;
  color: var(--danger);
  font-size: 13px;
  text-decoration: underline;
}

.version {
  margin: 16px 0 0;
  color: var(--text-faint);
  font-size: 12px;
}
</style>
