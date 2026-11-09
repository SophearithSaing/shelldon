<script setup lang="ts">
import { computed, ref, toRef, watch } from 'vue'
import type { DiffFile, DiffLine, SourceDiff } from '../../api/contracts/source'
import type { SemanticGroup, SemanticRead, SemanticReview } from '../../api/contracts/generation'
import { useGeneration } from '../../composables/useGeneration'
import { useConversationContext } from '../../composables/useConversations'
import { useReadingPosition } from '../../composables/useReadingPosition'
import GenerationPanel from '../workspace/GenerationPanel.vue'
import ReviewLayout from '../../layouts/ReviewLayout.vue'
import ConversationsRail from '../conversations/ConversationsRail.vue'
import ConversationPanel from '../conversations/ConversationPanel.vue'
import SemanticGroups from './SemanticGroups.vue'
import SemanticExcerpt from './SemanticExcerpt.vue'
import RemainingFile from './RemainingFile.vue'

const props = defineProps<{ prId: string; source: SourceDiff | null; sourcePending: boolean; active: boolean; filesCollapsed: boolean; understood: Set<string> }>()
const emit = defineEmits<{ source: []; collapse: []; understood: [fileID: string] }>()
const q = useConversationContext()
const generation = useGeneration<SemanticRead>(props.prId, 'semantic-review', toRef(props, 'source'), toRef(props, 'sourcePending'), toRef(props, 'active'))
const review = computed((): SemanticReview | null => generation.result.value?.review ?? null)
const count = computed((): number | undefined => review.value?.groups.length)
const selected = ref('')
const content = ref<HTMLElement | null>(null)
useReadingPosition(content, toRef(props, 'active'))
const matching = computed((): boolean => !!review.value && props.source?.revisionID === review.value.diff.revisionID)
const group = computed((): SemanticGroup | undefined => review.value?.groups.find((item): boolean => item.groupID === selected.value))
const understoodCount = computed((): number => matching.value ? review.value!.diff.files.filter((file): boolean => props.understood.has(file.id)).length : 0)
const percentage = computed((): number => review.value?.diff.files.length ? Math.round(100 * understoodCount.value / review.value.diff.files.length) : 0)
const covered = computed((): Set<string> => {
  const ids = new Set<string>()
  if (!review.value) return ids
  for (const item of review.value.groups) for (const range of item.ranges) {
    const hunk = review.value.diff.files.find((file): boolean => file.id === range.fileID)?.hunks?.find((candidate): boolean => candidate.id === range.hunkID)
    for (const line of hunk?.lines ?? []) {
      const coordinate = range.side === 'old' ? line.oldLine : line.newLine
      if (coordinate !== undefined && coordinate >= range.start && coordinate <= range.end && line.sign === (range.side === 'old' ? '-' : '+')) ids.add(line.id)
    }
  }
  return ids
})
const remainder = computed((): { file: DiffFile; lines: DiffLine[] }[] => (review.value?.diff.files ?? []).map((file): { file: DiffFile; lines: DiffLine[] } => ({ file, lines: (file.hunks ?? []).flatMap((hunk): DiffLine[] => hunk.lines.filter((line): boolean => line.sign !== ' ' && !covered.value.has(line.id))) })))
const remainderCount = computed((): number => remainder.value.reduce((total, item): number => total + item.lines.length, 0))

/** Restores a valid initial group only when a new saved review replaces the old result. */
function resetGroup(): void { selected.value = review.value?.groups[0]?.groupID ?? 'remainder' }

watch((): string | undefined => review.value?.reviewID, resetGroup)
defineExpose({ count })
</script>

<template>
  <GenerationPanel kind="semantic" :has-result="!!review" :source-available="!!source" :older="!!review && !!source && !matching" :busy="generation.busy.value" :pending="generation.pending.value" :blocked="generation.blocked.value" :can-generate="generation.canGenerate.value" :status="generation.status.value" :error="generation.error.value" @generate="generation.start" @cancel="generation.cancel" @refresh="generation.read" @source="emit('source')">
    <ReviewLayout v-if="review" :files-collapsed="filesCollapsed" :conversations-collapsed="q.panelCollapsed.value">
      <template #files><SemanticGroups :groups="review.groups" :selected="selected" :visible="active" :collapsed="filesCollapsed" :understood="understoodCount" :total="review.diff.files.length" :percentage="percentage" :remainder="remainderCount" @select="selected = $event" @collapse="$emit('collapse')" /></template>
      <div ref="content" class="group-content" :key="`${review.reviewID}:${selected}`"><template v-if="group"><header><span>GROUP {{ review.groups.indexOf(group) + 1 }}</span><h3>{{ group.title }}</h3><p>{{ group.explanation }}</p></header><SemanticExcerpt v-for="(range, index) in group.ranges" :key="index" :diff="review.diff" :range="range" :understood="matching && understood.has(range.fileID)" :matching="matching" @understood="$emit('understood', $event)" /></template><template v-else><header><h3>Ungrouped changes</h3><p>{{ remainderCount }} changed lines remain outside the groups. All {{ review.diff.files.length }} changed files, including non-text changes, remain listed below.</p></header><RemainingFile v-for="item in remainder" :key="item.file.id" :file="item.file" :lines="item.lines" :revision-id="review.diff.revisionID" :matching="matching" :understood="matching && understood.has(item.file.id)" @understood="$emit('understood', $event)" /></template></div>
      <template #conversations><ConversationsRail :collapsed="q.panelCollapsed.value" @collapse="q.panelCollapsed.value = !q.panelCollapsed.value"><ConversationPanel :visible="active" /></ConversationsRail></template>
    </ReviewLayout>
  </GenerationPanel>
</template>

<style scoped>
.group-content { overflow: auto; min-height: 0; }
header { padding: 24px; border-bottom: 1px solid var(--border); margin-bottom: 16px; }
header > span { font-size: 10px; letter-spacing: 1.5px; color: var(--muted); }
h3 { font-size: 24px; font-weight: 600; margin: 8px 0; }
header p { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.7; }
@media (max-width: 760px) { .group-content { overflow: visible; } }
</style>
