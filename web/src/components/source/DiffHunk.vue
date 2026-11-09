<script setup lang="ts">
import { computed, onBeforeUnmount, ref, shallowRef, toRef, watch } from 'vue'
import type { DiffHunk, DiffLine } from '../../api/contracts/source'
import type { Anchor } from '../../api/contracts/questions'
import AppButton from '../ui/AppButton.vue'
import SyntaxText from './SyntaxText.vue'
import { useSyntaxHighlighting } from '../../composables/useSyntaxHighlighting'

const props = withDefaults(defineProps<{ hunk: DiffHunk; fileId?: string; oldPath?: string; newPath?: string; contextLines?: DiffLine[]; selectable?: boolean; anchor?: Anchor; locked?: boolean; hunkSelectable?: boolean }>(), { selectable: false, locked: false, hunkSelectable: true })
const emit = defineEmits<{ select: [anchor: Anchor]; ask: [anchor: Anchor]; selectionError: [message: string] }>()
const origin = ref<{ side: 'old' | 'new'; line: number } | null>(null)
const root = ref<HTMLElement | null>(null)
const preview = shallowRef<Anchor | null>(null)
let gesture: { index: number; pointer: number; x: number; y: number; touch: boolean } | null = null
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
 * Resolves a visual row range to one contiguous original side without dropping opposite-side rows.
 * @param event Current primary pointer position.
 * @returns Supported original anchor, or null for a cross-hunk/mixed-side gesture.
 */
function gestureAnchor(event: PointerEvent): Anchor | null {
  if (!gesture || !props.fileId) return null
  const row = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-line]')
  if (row?.closest('.hunk') !== root.value) return null
  const end = props.hunk.lines.findIndex((line): boolean => line.id === row.dataset.line)
  if (end < 0) return null
  const lines = props.hunk.lines.slice(Math.min(gesture.index, end), Math.max(gesture.index, end) + 1)
  const added = lines.some((line): boolean => line.sign === '+')
  const removed = lines.some((line): boolean => line.sign === '-')
  if (added && removed) return null
  const side = removed ? 'old' : 'new'
  const start = side === 'old' ? lines[0]?.oldLine : lines[0]?.newLine
  const last = lines.at(-1)
  const finish = side === 'old' ? last?.oldLine : last?.newLine
  if (start === undefined || finish === undefined) return null
  return { kind: 'lines', fileID: props.fileId, hunkID: props.hunk.id, side, start, end: finish }
}

/**
 * Previews a full-line range while native text selection remains available for copying.
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
  else emit('selectionError', 'Select lines on one side within one hunk. Use Select hunk to ask about both added and removed lines.')
}

/**
 * Begins direct code-line interaction without intercepting gutter controls or native text selection.
 * @param line Original row where the gesture began.
 * @param event Primary pointer press.
 */
function beginGesture(line: DiffLine, event: PointerEvent): void {
  if (!props.selectable || props.locked || !props.fileId || event.button !== 0 || !event.isPrimary || event.ctrlKey || event.metaKey || event.altKey || (event.target as Element).closest('button')) return
  cancelGesture()
  gesture = { index: props.hunk.lines.indexOf(line), pointer: event.pointerId, x: event.clientX, y: event.clientY, touch: event.pointerType === 'touch' }
  preview.value = gestureAnchor(event)
  window.addEventListener('pointermove', moveGesture)
  window.addEventListener('pointerup', finishGesture)
  window.addEventListener('pointercancel', cancelGesture)
  window.addEventListener('blur', cancelGesture)
}

watch((): boolean => props.locked, (locked): void => { if (locked) cancelGesture() })
onBeforeUnmount(cancelGesture)

/**
 * Selects one side within this hunk; Shift extends from the original gutter activation.
 * @param side Original or current coordinates.
 * @param line Activated line number.
 * @param event Pointer/keyboard activation.
 */
function select(side: 'old' | 'new', line: number, event: MouseEvent): void {
  if (!props.fileId || props.locked) return
  const start = event.shiftKey && origin.value?.side === side ? origin.value.line : line
  if (!event.shiftKey) origin.value = { side, line }
  emit('select', { kind: 'lines', fileID: props.fileId, hunkID: props.hunk.id, side, start: Math.min(start, line), end: Math.max(start, line) })
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
    <div class="hunk-heading"><span>@@ -{{ hunk.old.start }},{{ hunk.old.count }} +{{ hunk.new.start }},{{ hunk.new.count }} @@ {{ hunk.section }}</span><AppButton v-if="selectable && fileId && hunkSelectable" variant="quiet" :disabled="locked" @click="$emit('select', { kind: 'hunk', fileID: fileId, hunkID: hunk.id })">Select hunk</AppButton></div>
    <div class="rows"><template v-for="line in hunk.lines" :key="line.id"><div :data-line="line.id" :class="['line', { added: line.sign === '+', removed: line.sign === '-', selected: highlighted(line.oldLine, line.newLine) }]" @pointerdown="beginGesture(line, $event)">
      <button v-if="selectable && line.oldLine" class="number" :aria-label="`Select old line ${line.oldLine}`" :disabled="locked" @click="select('old', line.oldLine, $event)">{{ line.oldLine }}</button><span v-else class="number" aria-hidden="true">{{ line.oldLine }}</span><button v-if="selectable && line.newLine" class="number" :aria-label="`Select head line ${line.newLine}`" :disabled="locked" @click="select('new', line.newLine, $event)">{{ line.newLine }}</button><span v-else class="number" aria-hidden="true">{{ line.newLine }}</span><span class="sign" aria-hidden="true">{{ line.sign }}</span><code><SyntaxText :text="line.text" :tokens="syntax[line.id]" /><span v-if="line.noNewline" class="no-newline"> ⏎ No newline at end of file</span></code>
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
