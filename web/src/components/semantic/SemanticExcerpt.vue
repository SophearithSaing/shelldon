<script setup lang="ts">
import { computed } from 'vue'
import type { EvidenceAnchor } from '../../api/contracts/generation'
import type { Anchor, SourceReference } from '../../api/contracts/questions'
import type { DiffHunk as Hunk, SourceDiff } from '../../api/contracts/source'
import { useConversationContext } from '../../composables/useConversations'
import ChangedFileHeader from '../source/ChangedFileHeader.vue'
import DiffHunk from '../source/DiffHunk.vue'
import AppButton from '../ui/AppButton.vue'
import StatusMessage from '../ui/StatusMessage.vue'

const props = defineProps<{ diff: SourceDiff; range: EvidenceAnchor; understood: boolean; matching: boolean }>()
defineEmits<{ understood: [fileID: string] }>()
const q = useConversationContext()
const file = computed((): SourceDiff['files'][number] | undefined => props.diff.files.find((item): boolean => item.id === props.range.fileID))
const reference = computed((): SourceReference => ({ revisionID: props.diff.revisionID, anchor: { kind: 'lines', ...props.range }, oldPath: file.value?.oldPath, newPath: file.value?.newPath }))
const contextLines = computed((): Hunk['lines'] | undefined => file.value?.hunks?.find((item): boolean => item.id === props.range.hunkID)?.lines)
const excerpt = computed((): Hunk | null => {
  const original = file.value?.hunks?.find((item): boolean => item.id === props.range.hunkID)
  if (!original) return null
  const lines = original.lines.filter((line): boolean => { const coordinate = props.range.side === 'old' ? line.oldLine : line.newLine; return coordinate !== undefined && coordinate >= props.range.start && coordinate <= props.range.end })
  const old = lines.filter((line): boolean => line.oldLine !== undefined)
  const next = lines.filter((line): boolean => line.newLine !== undefined)
  return { ...original, old: { ...original.old, start: old[0]?.oldLine ?? original.old.start, count: old.length }, new: { ...original.new, start: next[0]?.newLine ?? original.new.start, count: next.length }, section: `${props.range.side === 'old' ? 'Old' : 'Head'} · L${props.range.start}–${props.range.end}`, lines }
})

/**
 * Opens the original-source composer directly from line-number activation or a gutter drag.
 * @param anchor Supported single-side selection.
 */
function askRange(anchor: Anchor): void { q.navigate({ ...reference.value, anchor }, true) }
</script>

<template><article class="excerpt" :aria-label="`Semantic excerpt ${file?.newPath ?? file?.oldPath ?? 'unavailable'}`"><template v-if="file && excerpt"><ChangedFileHeader :file="file" :understood="understood" :disabled="!matching" @understood="$emit('understood', $event)"><AppButton variant="quiet" :disabled="!matching || !!q.draft.value" @click="q.navigate(reference)">View in original diff</AppButton></ChangedFileHeader><DiffHunk :hunk="excerpt" :context-lines="contextLines" :old-path="file.oldPath" :new-path="file.newPath" :file-id="file.id" :selectable="matching" :locked="!!q.draft.value" @ask="askRange" @selection-error="q.error.value = $event" /></template><StatusMessage v-else tone="error">This saved excerpt does not resolve to its original source inventory.</StatusMessage></article></template>

<style scoped>
.excerpt { background: var(--paper); margin-bottom: 16px; }
</style>
