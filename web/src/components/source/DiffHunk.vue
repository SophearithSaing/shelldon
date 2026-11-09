<script setup lang="ts">
import { computed, ref, toRef } from 'vue'
import type { DiffHunk, DiffLine } from '../../api/contracts/source'
import type { Anchor } from '../../api/contracts/questions'
import AppButton from '../ui/AppButton.vue'
import SyntaxText from './SyntaxText.vue'
import { useSyntaxHighlighting } from '../../composables/useSyntaxHighlighting'

const props = withDefaults(defineProps<{ hunk: DiffHunk; fileId?: string; oldPath?: string; newPath?: string; contextLines?: DiffLine[]; selectable?: boolean; anchor?: Anchor; locked?: boolean; hunkSelectable?: boolean }>(), { selectable: false, locked: false, hunkSelectable: true })
const emit = defineEmits<{ select: [anchor: Anchor] }>()
const origin = ref<{ side: 'old' | 'new'; line: number } | null>(null)
const syntax = useSyntaxHighlighting(computed((): DiffLine[] => props.contextLines ?? props.hunk.lines), toRef(props, 'oldPath'), toRef(props, 'newPath'))

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
  if (!props.anchor) return false
  if (props.anchor.kind === 'hunk') return true
  const coordinate = props.anchor.side === 'old' ? oldLine : newLine
  return coordinate !== undefined && coordinate >= props.anchor.start! && coordinate <= props.anchor.end!
}
</script>

<template>
  <div class="hunk">
    <div class="hunk-heading"><span>@@ -{{ hunk.old.start }},{{ hunk.old.count }} +{{ hunk.new.start }},{{ hunk.new.count }} @@ {{ hunk.section }}</span><AppButton v-if="selectable && fileId && hunkSelectable" variant="quiet" :disabled="locked" @click="$emit('select', { kind: 'hunk', fileID: fileId, hunkID: hunk.id })">Select hunk</AppButton></div>
    <div class="rows"><template v-for="line in hunk.lines" :key="line.id"><div :data-line="line.id" :class="['line', { added: line.sign === '+', removed: line.sign === '-', selected: highlighted(line.oldLine, line.newLine) }]">
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
