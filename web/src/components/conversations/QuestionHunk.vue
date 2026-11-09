<script setup lang="ts">
import { computed } from 'vue'
import type { DiffHunk, DiffLine } from '../../api/contracts/source'
import type { Anchor } from '../../api/contracts/questions'
import { useConversationContext } from '../../composables/useConversations'
import type { ConversationThread } from '../../composables/useConversations'
import DiffHunkView from '../source/DiffHunk.vue'
import AppButton from '../ui/AppButton.vue'
import InitialQuestion from './InitialQuestion.vue'
import ConversationView from './ConversationView.vue'

const props = defineProps<{ hunk: DiffHunk; fileId: string; revisionId: string; oldPath?: string; newPath?: string }>()
const q = useConversationContext()
const selected = computed((): Anchor | undefined => q.selection.value?.revisionID === props.revisionId && q.selection.value.anchor.hunkID === props.hunk.id ? q.selection.value.anchor : undefined)
const retained = computed((): Anchor | undefined => q.draft.value?.context.revisionID === props.revisionId && q.draft.value.context.anchor.hunkID === props.hunk.id ? q.draft.value.context.anchor : undefined)
const matchingThreads = computed((): ConversationThread[] => q.threads.value.filter((thread): boolean => thread.context.revisionID === props.revisionId && thread.context.anchor.hunkID === props.hunk.id))

/**
 * Places a composer/marker directly after its original selection endpoint.
 * @param anchor Original selection.
 * @param line Current literal row.
 * @returns Whether this is the last row of the selection.
 */
function endsAt(anchor: Anchor | undefined, line: DiffLine): boolean {
  return !!anchor && (anchor.kind === 'hunk' ? line.id === props.hunk.lines.at(-1)?.id : (anchor.side === 'old' ? line.oldLine : line.newLine) === anchor.end)
}
</script>

<template>
  <DiffHunkView :hunk="hunk" :file-id="fileId" :old-path="oldPath" :new-path="newPath" selectable :anchor="retained ?? selected" :locked="!!q.draft.value" @select="q.select">
    <template #after-row="{ line }">
      <div v-if="!retained && endsAt(selected, line)" class="selection-actions"><AppButton variant="primary" @click="q.compose">Ask about selection</AppButton></div>
      <InitialQuestion v-if="endsAt(retained, line)" />
      <div v-for="thread in matchingThreads.filter((item): boolean => endsAt(item.context.anchor, line))" :key="thread.id" class="inline-thread"><ConversationView v-if="thread.inline" :thread="thread" inline /><AppButton v-else variant="quiet" @click="thread.inline = true">Open inline conversation · {{ thread.answers.length }} {{ thread.answers.length === 1 ? 'answer' : 'answers' }}</AppButton></div>
    </template>
  </DiffHunkView>
</template>

<style scoped>
.selection-actions { padding: 12px 16px; border-block: 1px solid var(--border); background: var(--canvas); }
.inline-thread { border-block: 1px solid var(--border); font: 12px var(--sans); }
.inline-thread > .button { margin: 8px 16px; }
</style>
