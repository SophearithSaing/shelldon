<script setup lang="ts">
import { useConversationContext } from '../../composables/useConversations'
import { referenceLabel } from '../../api/selection'
import AppButton from '../ui/AppButton.vue'
import StatusMessage from '../ui/StatusMessage.vue'
import QuestionComposer from './QuestionComposer.vue'

const q = useConversationContext()
</script>

<template>
  <section v-if="q.draft.value" class="initial-question" aria-label="Initial source question">
    <header><strong>Ask about this change</strong><span>{{ referenceLabel(q.draft.value.context) }}</span></header>
    <StatusMessage v-if="q.draft.value.error" tone="error">{{ q.draft.value.error }}</StatusMessage>
    <div v-if="q.draft.value.paused" class="retained"><span>Your draft is retained on this range.</span><AppButton @click="q.draft.value.paused = false">Resume question</AppButton><AppButton variant="quiet" @click="q.discard">Discard draft</AppButton></div>
    <template v-else><QuestionComposer v-model="q.draft.value.text" initial autofocus :sending="q.draft.value.sending" :unavailable="q.draft.value.uncertain || q.busy(q.draft.value.context.revisionID)" @send="q.submit" @cancel="q.draft.value.paused = true" /><AppButton variant="quiet" :disabled="q.draft.value.sending" @click="q.discard">Discard draft</AppButton></template>
  </section>
</template>

<style scoped>
.initial-question { padding: 16px; background: var(--canvas); border-block: 1px solid var(--border); font: 12px/1.5 var(--sans); }
header { display: flex; flex-wrap: wrap; gap: 6px 16px; align-items: center; margin-bottom: 12px; }
header span { color: var(--muted); font: 10px var(--mono); overflow-wrap: anywhere; }
.retained { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; color: var(--muted); }
.composer { margin-top: 12px; }
</style>
