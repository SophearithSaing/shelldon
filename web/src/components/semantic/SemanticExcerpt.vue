<script setup lang="ts">
import { computed, ref } from 'vue'
import type { EvidenceAnchor } from '../../api/contracts/generation'
import type { Anchor, SourceReference } from '../../api/contracts/questions'
import type { DiffHunk as Hunk, SourceDiff } from '../../api/contracts/source'
import { selectionContext } from '../../api/selection'
import { useConversationContext } from '../../composables/useConversations'
import ChangedFileHeader from '../source/ChangedFileHeader.vue'
import DiffHunk from '../source/DiffHunk.vue'
import AppButton from '../ui/AppButton.vue'
import StatusMessage from '../ui/StatusMessage.vue'

const props = defineProps<{ diff: SourceDiff; range: EvidenceAnchor; understood: boolean; matching: boolean }>()
defineEmits<{ understood: [fileID: string] }>()
const q = useConversationContext()
const chosen = ref<Anchor | undefined>(undefined)
const file = computed((): SourceDiff['files'][number] | undefined => props.diff.files.find((item): boolean => item.id === props.range.fileID))
const reference = computed((): SourceReference => ({ revisionID: props.diff.revisionID, anchor: { kind: 'lines', ...props.range }, oldPath: file.value?.oldPath, newPath: file.value?.newPath }))
const excerpt = computed((): Hunk | null => {
  const original = file.value?.hunks?.find((item): boolean => item.id === props.range.hunkID)
  if (!original) return null
  const lines = original.lines.filter((line): boolean => { const coordinate = props.range.side === 'old' ? line.oldLine : line.newLine; return coordinate !== undefined && coordinate >= props.range.start && coordinate <= props.range.end })
  const old = lines.filter((line): boolean => line.oldLine !== undefined)
  const next = lines.filter((line): boolean => line.newLine !== undefined)
  return { ...original, old: { ...original.old, start: old[0]?.oldLine ?? original.old.start, count: old.length }, new: { ...original.new, start: next[0]?.newLine ?? original.new.start, count: next.length }, section: `${props.range.side === 'old' ? 'Old' : 'Head'} · L${props.range.start}–${props.range.end}`, lines }
})

/**
 * Keeps excerpt selection local until the user explicitly asks from it.
 * @param anchor Selected excerpt range.
 */
function select(anchor: Anchor): void { if (selectionContext(props.diff, anchor)) chosen.value = anchor }

/** Opens the existing single-range composer in Files changed without dispatching a question. */
function ask(): void { if (chosen.value) q.navigate({ ...reference.value, anchor: chosen.value }, true) }
</script>

<template><article class="excerpt" :aria-label="`Semantic excerpt ${file?.newPath ?? file?.oldPath ?? 'unavailable'}`"><template v-if="file && excerpt"><ChangedFileHeader :file="file" :understood="understood" :disabled="!matching" @understood="$emit('understood', $event)"><AppButton variant="quiet" :disabled="!matching || !!q.draft.value" @click="q.navigate(reference)">View in original diff</AppButton></ChangedFileHeader><DiffHunk :hunk="excerpt" :file-id="file.id" :selectable="matching" :hunk-selectable="false" :locked="!!q.draft.value" :anchor="chosen" @select="select" /><div v-if="chosen" class="ask"><AppButton variant="primary" :disabled="!matching || !!q.draft.value" @click="ask">Ask about selected range</AppButton></div></template><StatusMessage v-else tone="error">This saved excerpt does not resolve to its original source inventory.</StatusMessage></article></template>

<style scoped>
.excerpt { background: var(--paper); margin-bottom: 16px; }
.ask { padding: 12px 16px; border-top: 1px solid var(--border); }
</style>
