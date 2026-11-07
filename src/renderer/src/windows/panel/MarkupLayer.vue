<script setup lang="ts">
import { computed, ref, useTemplateRef } from "vue";
import {
  MARK_COLOR,
  distance,
  markWidth,
  shapesFor,
  touches,
  viewBoxOf,
  type Mark,
  type Point,
  type Tool,
} from "./marks";

// A see-through layer over the preview where you draw red marks. It uses the diagram's
// own viewBox and the same "contain" fit as the <img> under it, so marks land exactly on
// the diagram whatever size the preview is.

const props = defineProps<{ svg: string; tool: Tool; disabled: boolean }>();
const marks = defineModel<Mark[]>({ required: true });

const MAX_POINTS = 600; // per pen stroke, so a long scribble stays a reasonable size

const layer = useTemplateRef<SVGSVGElement>("layer");
const box = computed(() => viewBoxOf(props.svg));
const width = computed(() => markWidth(box.value));
const viewBox = computed(
  () => `${box.value.x} ${box.value.y} ${box.value.width} ${box.value.height}`,
);

const draft = ref<Mark | null>(null); // the mark being drawn right now
let erasing = false;

const shown = computed(() =>
  draft.value ? [...marks.value, draft.value] : marks.value,
);

/** Screen position → diagram coordinates. */
function toDiagram(event: PointerEvent): Point {
  const ctm = layer.value?.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(
    ctm.inverse(),
  );
  return { x: point.x, y: point.y };
}

function eraseAt(point: Point): void {
  const kept = marks.value.filter(
    (mark) => !touches(mark, point, width.value * 2.5),
  );
  if (kept.length !== marks.value.length) marks.value = kept;
}

function onDown(event: PointerEvent): void {
  if (props.disabled || event.button !== 0) return;
  try {
    layer.value?.setPointerCapture(event.pointerId); // keep drawing even if the pointer leaves
  } catch {
    // Some pointers can't be captured; drawing still works while over the preview.
  }
  const point = toDiagram(event);
  if (props.tool === "erase") {
    erasing = true;
    eraseAt(point);
  } else if (props.tool === "pen") {
    draft.value = { kind: "pen", points: [point] };
  } else {
    draft.value = { kind: "arrow", from: point, to: point };
  }
}

function onMove(event: PointerEvent): void {
  const point = toDiagram(event);
  if (erasing) {
    eraseAt(point);
    return;
  }
  const mark = draft.value;
  if (mark?.kind === "pen") {
    const last = mark.points[mark.points.length - 1];
    // Skip tiny movements, which only add points without changing the line.
    if (
      distance(last, point) >= width.value * 0.6 &&
      mark.points.length < MAX_POINTS
    ) {
      mark.points.push(point);
    }
  } else if (mark?.kind === "arrow") {
    mark.to = point;
  }
}

function onUp(): void {
  erasing = false;
  const mark = draft.value;
  draft.value = null;
  if (!mark) return;
  // A click with the Arrow tool isn't an arrow.
  if (mark.kind === "arrow" && distance(mark.from, mark.to) < width.value * 3) {
    return;
  }
  marks.value = [...marks.value, mark];
}
</script>

<template>
  <svg
    ref="layer"
    class="markup"
    :class="[`tool-${tool}`, { disabled }]"
    :viewBox="viewBox"
    preserveAspectRatio="xMidYMid meet"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
  >
    <template v-for="(mark, i) in shown" :key="i">
      <path
        v-for="(shape, j) in shapesFor(mark, width)"
        :key="j"
        :d="shape.d"
        :fill="shape.filled ? MARK_COLOR : 'none'"
        :stroke="shape.filled ? 'none' : MARK_COLOR"
        :stroke-width="width"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </template>
  </svg>
</template>

<style scoped>
.markup {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  /* Pen and touch drawing shouldn't scroll or zoom the page. */
  touch-action: none;
}

.markup.tool-pen,
.markup.tool-arrow {
  cursor: crosshair;
}

.markup.tool-erase {
  cursor: cell;
}

.markup.disabled {
  cursor: default;
  pointer-events: none;
}

path {
  pointer-events: none;
}
</style>
