<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useConversationContext } from '../../composables/useConversations'
import type { ConversationThread } from '../../composables/useConversations'
import { referenceLabel } from '../../api/selection'
import AppButton from '../ui/AppButton.vue'
import StatusMessage from '../ui/StatusMessage.vue'
import ConversationView from '../conversations/ConversationView.vue'

const props = defineProps<{ active: boolean }>()
const q = useConversationContext()
const opened = ref(false)
const current = computed((): ConversationThread | undefined => q.threads.value.find((thread): boolean => thread.id === q.selected.value))

/** Reads saved history on the first explicit Questions visit, never source/inference. */
async function enter(): Promise<void> {
  if (props.active && !opened.value) { opened.value = true; await q.refreshList() }
}

watch((): boolean => props.active, enter, { immediate: true })
</script>

<template>
  <section class="saved-questions" aria-label="Saved questions">
    <header><div><h2>Questions</h2><p>Return to the reasoning behind the changes.</p></div><AppButton :disabled="q.historyPending.value" @click="q.refreshList">Refresh saved questions</AppButton></header>
    <StatusMessage v-if="q.historyError.value" tone="error">{{ q.historyError.value }}</StatusMessage>
    <StatusMessage v-if="q.historyPending.value">Reading saved questions…</StatusMessage>
    <div class="history"><nav aria-label="Saved question threads"><p v-if="q.list.value && !q.list.value.threads.length">No saved questions yet. Ask from a changed line or hunk in Files changed.</p><button v-for="thread in q.list.value?.threads ?? []" :key="thread.threadID" :aria-current="thread.threadID === q.selected.value ? 'true' : undefined" @click="q.openSaved(thread.threadID)"><strong>{{ thread.question }}</strong><span>{{ referenceLabel({ ...thread, revisionID: thread.revisionID }) }}</span><small>{{ thread.answerCount }} {{ thread.answerCount === 1 ? 'answer' : 'answers' }} · {{ thread.state }}{{ thread.executionUnknown ? ' · outcome unknown' : '' }}</small></button></nav><div class="detail"><AppButton v-if="current" @click="q.openSaved(current.id)">Refresh saved thread</AppButton><ConversationView v-if="current" :key="current.id" :thread="current" /><p v-else>Select a saved question to reopen its original context and answers.</p></div></div>
  </section>
</template>

<style scoped>
.saved-questions { min-height: 0; flex: 1; display: flex; flex-direction: column; }
header { display: flex; align-items: center; gap: 16px; justify-content: space-between; padding: 24px; border-bottom: 1px solid var(--border); }
h2 { font-size: 22px; margin: 0; font-weight: 600; }
p { color: var(--muted); font-size: 12px; }
header p { margin: 4px 0 0; }
.history { display: grid; grid-template-columns: 300px minmax(0, 1fr); min-height: 0; flex: 1; }
nav { border-right: 1px solid var(--border); padding: 12px; overflow: auto; }
nav button { display: block; width: 100%; text-align: left; padding: 14px; margin-bottom: 6px; background: transparent; color: var(--ink); border: 1px solid transparent; border-radius: 8px; overflow-wrap: anywhere; }
nav button[aria-current] { background: var(--accent-soft); border-color: var(--border-strong); }
nav strong { font-size: 12px; font-weight: 550; display: block; }
nav span, nav small { display: block; color: var(--muted); margin-top: 8px; font-size: 10px; }
nav span { font-family: var(--mono); }
.detail { padding: 16px; overflow: auto; min-width: 0; }
.detail > .button { margin: 0 16px 12px; }
@media (max-width: 900px) { .history { grid-template-columns: 240px minmax(0, 1fr); } }
@media (max-width: 760px) { header { flex-wrap: wrap; padding: 16px; } .history { display: block; overflow: auto; } nav { border-right: 0; border-bottom: 1px solid var(--border); max-height: 280px; } .detail { overflow: visible; padding: 8px; } }
</style>
