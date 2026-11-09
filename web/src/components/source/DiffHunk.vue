<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, toRef, watch } from 'vue'
import type { DiffHunk, DiffLine } from '../../api/contracts/source'
import type { Anchor } from '../../api/contracts/questions'
import SyntaxText from './SyntaxText.vue'
import { useSyntaxHighlighting } from '../../composables/useSyntaxHighlighting'

const props = withDefaults(defineProps<{ hunk: DiffHunk; fileId?: string; oldPath?: string; newPath?: string; contextLines?: DiffLine[]; selectable?: boolean; anchor?: Anchor; locked?: boolean }>(), { selectable: false, locked: false })
const emit = defineEmits<{ ask: [anchor: Anchor]; selectionError: [message: string] }>()
const root = ref<HTMLElement | null>(null)
const preview = shallowRef<Anchor | null>(null)
let gesture: { side: 'old' | 'new'; line: number; pointer: number; x: number; y: number; touch: boolean } | null = null
const syntax = useSyntaxHighlighting(computed((): DiffLine[] => props.contextLines ?? props.hunk.lines), toRef(props, 'oldPath'), toRef(props, 'newPath'))

/** Clears only this hunk's transient pointer gesture, never a retained question draft. */
function cancelGesture(): void {
  gesture = null
  preview.value = null
  window.removeEventListener('pointermove', moveGesture)
  window.removeEventListener('pointerup', finishGesture)
  window.removeEventListener('pointercancel', cancelGesture)
  window.removeEventListener('blur', cancelGesture)
}

/**
 * Resolves a line-number drag within its original gutter column and hunk.
 * @param event Current primary pointer position.
 * @returns Original side-specific range, or null outside the owning gutter.
 */
function gestureAnchor(event: PointerEvent): Anchor | null {
  if (!gesture || !props.fileId) return null
  const number = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('button.number')
  if (number?.closest('.hunk') !== root.value || number.dataset.side !== gesture.side) return null
  const end = Number(number.dataset.coordinate)
  if (!Number.isSafeInteger(end) || end <= 0) return null
  return { kind: 'lines', fileID: props.fileId, hunkID: props.hunk.id, side: gesture.side, start: Math.min(gesture.line, end), end: Math.max(gesture.line, end) }
}

/**
 * Previews the original-side range while dragging over line numbers.
 * @param event Pointer movement within the active gesture.
 */
function moveGesture(event: PointerEvent): void {
  if (!gesture || event.pointerId !== gesture.pointer) return
  if (gesture.touch && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8) { cancelGesture(); return }
  preview.value = gestureAnchor(event)
}

/**
 * Opens a question only after a click or completed drag, never during selection or on pointer cancellation.
 * @param event Released primary pointer.
 */
function finishGesture(event: PointerEvent): void {
  if (!gesture || event.pointerId !== gesture.pointer) return
  if (gesture.touch && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) > 8) { cancelGesture(); return }
  const anchor = gestureAnchor(event)
  cancelGesture()
  if (props.locked || !props.selectable) return
  if (anchor) emit('ask', anchor)
  else emit('selectionError', 'Drag line numbers within the same old or head column and hunk.')
}

/**
 * Begins question selection only from a line-number button, leaving code selection untouched.
 * @param side Original gutter column.
 * @param line Original line number.
 * @param event Primary pointer press.
 */
function beginGesture(side: 'old' | 'new', line: number, event: PointerEvent): void {
  if (!props.selectable || props.locked || !props.fileId || event.button !== 0 || !event.isPrimary || event.ctrlKey || event.metaKey || event.altKey) return
  cancelGesture()
  if (event.pointerType !== 'touch') event.preventDefault()
  gesture = { side, line, pointer: event.pointerId, x: event.clientX, y: event.clientY, touch: event.pointerType === 'touch' }
  preview.value = gestureAnchor(event)
  window.addEventListener('pointermove', moveGesture)
  window.addEventListener('pointerup', finishGesture)
  window.addEventListener('pointercancel', cancelGesture)
  window.addEventListener('blur', cancelGesture)
}

watch((): boolean => props.locked, (locked): void => { if (locked) cancelGesture() })
onBeforeUnmount(cancelGesture)

/**
 * Opens the same question directly for keyboard or assistive button activation.
 * @param side Original or current coordinates.
 * @param line Activated line number.
 * @param event Native button activation; pointer gestures are handled on release instead.
 */
function activate(side: 'old' | 'new', line: number, event: MouseEvent): void {
  if (!props.fileId || props.locked || !props.selectable || event.detail !== 0) return
  emit('ask', { kind: 'lines', fileID: props.fileId, hunkID: props.hunk.id, side, start: line, end: line })
}

/**
 * Checks whether a literal row belongs to the selected original range.
 * @param oldLine Original coordinate.
 * @param newLine Current coordinate.
 * @returns Whether this row is selected.
 */
function highlighted(oldLine?: number, newLine?: number): boolean {
  const anchor = preview.value ?? props.anchor
  if (!anchor) return false
  if (anchor.kind === 'hunk') return true
  const coordinate = anchor.side === 'old' ? oldLine : newLine
  return coordinate !== undefined && coordinate >= anchor.start! && coordinate <= anchor.end!
}
</script>

<template>
  <div ref="root" class="hunk">
    <div class="hunk-heading"><span>@@ -{{ hunk.old.start }},{{ hunk.old.count }} +{{ hunk.new.start }},{{ hunk.new.count }} @@ {{ hunk.section }}</span></div>
    <div class="rows"><template v-for="line in hunk.lines" :key="line.id"><div :data-line="line.id" :class="['line', { added: line.sign === '+', removed: line.sign === '-', selected: highlighted(line.oldLine, line.newLine) }]">
      <button v-if="selectable && line.oldLine" class="number" data-side="old" :data-coordinate="line.oldLine" :aria-label="`Ask about old line ${line.oldLine}`" :disabled="locked" @pointerdown="beginGesture('old', line.oldLine, $event)" @click="activate('old', line.oldLine, $event)">{{ line.oldLine }}</button><span v-else class="number" aria-hidden="true">{{ line.oldLine }}</span><button v-if="selectable && line.newLine" class="number" data-side="new" :data-coordinate="line.newLine" :aria-label="`Ask about head line ${line.newLine}`" :disabled="locked" @pointerdown="beginGesture('new', line.newLine, $event)" @click="activate('new', line.newLine, $event)">{{ line.newLine }}</button><span v-else class="number" aria-hidden="true">{{ line.newLine }}</span><span class="sign" aria-hidden="true">{{ line.sign }}</span><code><SyntaxText :text="line.text" :tokens="syntax[line.id]" /><span v-if="line.noNewline" class="no-newline"> ⏎ No newline at end of file</span></code>
    </div><slot name="after-row" :line="line" /></template></div>
  </div>
</template>

<style scoped>
.hunk { min-width: 0; padding-bottom: 12px; background: var(--paper); }
.hunk-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; background: var(--surface); color: var(--muted); font: 10px/32px var(--mono); padding: 0 18px; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.hunk-heading > span { min-width: 0; overflow-wrap: anywhere; }
.rows { overflow-x: auto; }
.line { display: flex; width: max-content; min-width: 100%; min-height: 27px; font: 11px/27px var(--mono); }
.number { display: block; flex: 0 0 38px; text-align: right; padding: 0 10px 0 0; color: var(--muted); user-select: none; border: 0; background: transparent; font: inherit; }
button.number:not(:disabled) { cursor: pointer; }
button.number:hover:not(:disabled) { color: var(--accent); background: var(--selected); }
.sign { flex: 0 0 22px; color: var(--muted); text-align: center; user-select: none; }
code { display: block; white-space: pre; padding-right: 24px; font: inherit; }
.added { background: var(--added-bg); }
.removed { background: var(--removed-bg); }
.added .sign { color: var(--added); }
.removed .sign { color: var(--removed); }
.selected { background: var(--selected); box-shadow: inset 2px 0 var(--accent); }
.no-newline { color: var(--muted); font-style: italic; }
</style>
