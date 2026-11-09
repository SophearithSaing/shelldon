<script setup lang="ts">
import { computed, ref } from 'vue'
import { useConversationContext } from '../../composables/useConversations'
import type { ConversationThread } from '../../composables/useConversations'
import ConversationView from './ConversationView.vue'
import { useReadingPosition } from '../../composables/useReadingPosition'

const q = useConversationContext()
const props = defineProps<{ visible: boolean }>()
const current = computed((): ConversationThread | undefined => q.threads.value.find((thread): boolean => thread.id === q.selected.value))
const root = ref<HTMLElement | null>(null)
useReadingPosition(computed((): HTMLElement | null => root.value?.closest('aside') ?? null), computed((): boolean => props.visible && !q.panelCollapsed.value), q.selected)
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
