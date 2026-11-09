<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useConversationContext } from '../../composables/useConversations'
import type { ConversationThread } from '../../composables/useConversations'
import ConversationView from './ConversationView.vue'

const q = useConversationContext()
const current = computed((): ConversationThread | undefined => q.threads.value.find((thread): boolean => thread.id === q.selected.value))
const root = ref<HTMLElement | null>(null)
const positions = new Map<string, number>()

/**
 * Keeps per-thread reading positions in this panel, independent of inline views.
 * @param next Newly selected thread.
 * @param previous Previously selected thread.
 */
async function retainPosition(next: string, previous: string): Promise<void> {
  const pane = root.value?.closest('aside')
  if (!pane) return
  positions.set(previous, pane.scrollTop)
  await nextTick()
  pane.scrollTop = positions.get(next) ?? 0
}

watch(q.selected, retainPosition)
</script>

<template>
  <div ref="root" class="panel"><label v-if="q.threads.value.length">Conversation<select v-model="q.selected.value" aria-label="Choose conversation"><option v-for="thread in q.threads.value" :key="thread.id" :value="thread.id">{{ thread.answers[0]?.question.slice(0, 100) }}</option></select></label><ConversationView v-if="current" :key="current.id" :thread="current" /><template v-else><p>No conversations yet.</p><p>Select changed lines to ask a question.</p></template></div>
</template>

<style scoped>
.panel { min-width: 0; }
label { display: block; color: var(--muted); font-size: 10px; margin: 0 12px 12px; }
select { display: block; width: 100%; min-width: 0; border: 1px solid var(--border-strong); border-radius: 6px; padding: 8px; margin-top: 5px; background: var(--paper); color: var(--ink); font-size: 11px; }
p { color: var(--muted); font-size: 12px; padding: 0 12px; }
</style>
