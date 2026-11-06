<script setup lang="ts">
import { onMounted, ref } from "vue";

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
  <main class="settings">
    <h2>Settings</h2>

    <section class="card">
      <h3>Claude API key</h3>
      <p class="muted">
        Picasso draws using your own Claude API key. It's encrypted with your
        Windows account and stored only on this PC.
      </p>

      <p class="status" :class="{ saved: hasKey }">
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
      <p v-if="error" class="error">{{ error }}</p>

      <button v-if="hasKey" class="remove" @click="remove">Remove key</button>
    </section>
  </main>
</template>

<style scoped>
.settings {
  flex: 1;
  width: 100%;
  max-width: 560px;
  margin: 0 auto;
  padding: 24px;
}

h2 {
  margin: 0 0 16px;
  font-size: 22px;
}

.card {
  padding: 16px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
}

h3 {
  margin: 0 0 4px;
  font-size: 15px;
}

.muted {
  margin: 0 0 12px;
  color: var(--text-muted);
  font-size: 13px;
}

.status {
  display: inline-block;
  margin: 0 0 12px;
  padding: 2px 10px;
  border: 1px solid var(--border);
  border-radius: 999px;
  color: var(--text-muted);
  font-size: 12px;
}

.status.saved {
  border-color: #16a34a;
  color: #16a34a;
}

.key-form {
  display: flex;
  gap: 8px;
}

.key-form input {
  flex: 1;
  min-width: 0;
  padding: 8px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--bg);
  outline: none;
}

.key-form input:focus {
  border-color: var(--accent);
}

.error {
  margin: 8px 0 0;
  color: #dc2626;
  font-size: 13px;
}

.remove {
  margin-top: 12px;
  padding: 0;
  border: none;
  background: none;
  color: #dc2626;
  font-size: 13px;
  text-decoration: underline;
}
</style>
