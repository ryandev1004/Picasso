<script setup lang="ts">
import { computed } from "vue";
import type { DrawingSummary } from "@shared/ipc";
import {
  DATE_GROUPS,
  formatDay,
  formatTime,
  groupFor,
  type DateGroup,
} from "@renderer/lib/dates";
import { withVersions } from "@renderer/lib/format";

const props = defineProps<{
  drawings: DrawingSummary[];
  selectedId: string | null;
  searching: boolean;
  loaded: boolean;
}>();
defineEmits<{ select: [id: string] }>();

/** The drawings under Today, Yesterday… headings. They arrive newest first, so each group is too. */
const groups = computed(() => {
  const now = new Date();
  const byGroup = new Map<DateGroup, DrawingSummary[]>();
  for (const drawing of props.drawings) {
    const group = groupFor(drawing.updatedAt, now);
    const items = byGroup.get(group);
    if (items) items.push(drawing);
    else byGroup.set(group, [drawing]);
  }
  return DATE_GROUPS.flatMap((label) => {
    const items = byGroup.get(label);
    return items ? [{ label, items }] : [];
  });
});

/** The grey line under each title: a time for the last two days, a date before that. */
function subtitle(drawing: DrawingSummary, group: DateGroup): string {
  const when =
    group === "Today" || group === "Yesterday"
      ? formatTime(drawing.updatedAt)
      : formatDay(drawing.updatedAt);
  return withVersions(when, drawing.versionCount);
}
</script>

<template>
  <nav class="drawing-list" aria-label="Drawings">
    <p v-if="loaded && drawings.length === 0" class="empty">
      {{
        searching
          ? "No drawings match your search."
          : "Your drawings will show up here."
      }}
    </p>

    <section v-for="group in groups" :key="group.label">
      <h3>{{ group.label }}</h3>
      <button
        v-for="drawing in group.items"
        :key="drawing.id"
        class="item"
        :class="{ active: drawing.id === selectedId }"
        @click="$emit('select', drawing.id)"
      >
        <span class="title truncate">{{ drawing.title }}</span>
        <span class="sub truncate">{{ subtitle(drawing, group.label) }}</span>
      </button>
    </section>
  </nav>
</template>

<style scoped>
.drawing-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.empty {
  margin: 8px 12px 0;
  color: var(--text-faint);
  font-size: 13px;
}

h3 {
  margin: 14px 12px 4px;
  color: var(--text-faint);
  font-size: 12px;
  font-weight: 400;
}

.item {
  display: flex;
  flex-direction: column;
  width: 100%;
  padding: 7px 12px;
  border: none;
  border-radius: var(--radius);
  background: transparent;
  text-align: left;
}

.item:hover {
  background: var(--fill-soft);
}

.item.active {
  background: var(--fill-strong);
}

.title {
  line-height: 1.35;
}

.sub {
  color: var(--text-muted);
  font-size: 12.5px;
  line-height: 1.35;
}
</style>
