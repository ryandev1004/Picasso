<script setup lang="ts">
import { useId } from "vue";

// Shown while Claude draws: a little pencil sketching a box → box diagram, on a loop.
// SVG's own animation (<animate>, <animateMotion>) keeps the pencil tip exactly on the line
// as it's drawn, because both follow the same path with the same timing.

defineProps<{ caption: string }>();

// One continuous stroke: a box, an arrow (tip and wings), then a second box.
const SKETCH =
  "M66 50 L66 30 L14 30 L14 70 L66 70 L66 50 L126 50 L118 44 L126 50 L118 56 L126 50 L134 50 L134 30 L186 30 L186 70 L134 70 L134 50";

const lineId = `pencil-line-${useId()}`; // unique, in case two loaders are ever on the page
const reduceMotion = window.matchMedia(
  "(prefers-reduced-motion: reduce)",
).matches;

// One loop: draw for 75% of it, hold, then fade out and start again.
const DURATION = "2.8s";
const DRAW_TIMES = "0;0.75;1";
</script>

<template>
  <div class="pencil-loader" role="status">
    <svg viewBox="0 0 200 100" aria-hidden="true">
      <path
        :id="lineId"
        class="sketch"
        :d="SKETCH"
        pathLength="1"
        stroke-dasharray="1"
        :stroke-dashoffset="reduceMotion ? 0 : 1"
      >
        <template v-if="!reduceMotion">
          <animate
            attributeName="stroke-dashoffset"
            values="1;0;0"
            :keyTimes="DRAW_TIMES"
            :dur="DURATION"
            repeatCount="indefinite"
          />
          <animate
            attributeName="opacity"
            values="1;1;0"
            keyTimes="0;0.85;1"
            :dur="DURATION"
            repeatCount="indefinite"
          />
        </template>
      </path>

      <!-- The pencil, tip at (0, 0), held at a slant like in a hand. -->
      <g :transform="reduceMotion ? 'translate(134 50)' : undefined">
        <g transform="rotate(-45)">
          <path d="M0 0 L12 -6 L12 6 Z" fill="#f3dfb8" />
          <path d="M0 0 L4.5 -2.2 L4.5 2.2 Z" fill="#24211c" />
          <rect x="12" y="-6" width="30" height="12" fill="#529961" />
          <rect x="12" y="-6" width="30" height="4" fill="#62ab72" />
          <rect x="42" y="-6" width="4" height="12" fill="#c9c2b8" />
          <rect x="46" y="-6" width="7" height="12" rx="2.5" fill="#e5484d" />
        </g>
        <template v-if="!reduceMotion">
          <animateMotion
            :dur="DURATION"
            repeatCount="indefinite"
            calcMode="linear"
            keyPoints="0;1;1"
            :keyTimes="DRAW_TIMES"
          >
            <mpath :href="`#${lineId}`" />
          </animateMotion>
          <animate
            attributeName="opacity"
            values="0;1;1;0"
            keyTimes="0;0.05;0.85;1"
            :dur="DURATION"
            repeatCount="indefinite"
          />
        </template>
      </g>
    </svg>
    <span class="caption">{{ caption }}</span>
  </div>
</template>

<style scoped>
.pencil-loader {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  padding: 10px 18px 8px;
  border-radius: var(--radius-lg);
  background: rgb(255 255 255 / 0.88);
  box-shadow: 0 1px 3px rgb(0 0 0 / 0.06);
}

svg {
  display: block;
  width: 168px;
  height: 84px;
  overflow: visible; /* the pencil leans out past the edges of the sketch */
}

.sketch {
  fill: none;
  stroke: var(--text);
  stroke-width: 3;
  stroke-linecap: round;
  stroke-linejoin: round;
}

.caption {
  color: var(--text-muted);
  font-family: var(--font-mono);
  font-size: 12.5px;
}
</style>
