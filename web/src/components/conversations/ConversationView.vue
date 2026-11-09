<script setup lang="ts">
import { referenceLabel } from '../../api/selection'
import { terminal, useConversationContext } from '../../composables/useConversations'
import type { ConversationThread } from '../../composables/useConversations'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import StatusMessage from '../ui/StatusMessage.vue'
import SourceQuote from '../source/SourceQuote.vue'
import QuestionComposer from './QuestionComposer.vue'

defineProps<{ thread: ConversationThread; inline?: boolean }>()
const q = useConversationContext()
</script>

<template>
  <section class="conversation" :data-thread="thread.id" :aria-label="inline ? 'Inline conversation' : 'Conversation'">
    <header><span class="anchor">{{ referenceLabel(thread.context) }}</span><span v-if="!q.matching(thread.context)" class="older">Original revision</span><div><AppButton v-if="inline" variant="quiet" @click="q.openPanel(thread)">Open in panel</AppButton><AppButton v-else variant="quiet" :disabled="!q.matching(thread.context) || !!q.draft.value" @click="q.showInline(thread)">Show inline</AppButton><AppButton v-if="inline" variant="quiet" @click="thread.inline = false">Hide inline</AppButton></div></header>
    <details class="context"><summary>Pinned context</summary><p>{{ thread.context.revision.mergeBaseSHA.slice(0, 8) }} → {{ thread.context.revision.headSHA.slice(0, 8) }}</p><SourceQuote :lines="thread.context.selected" /></details>
    <div class="messages" role="log" aria-label="Conversation transcript" aria-live="polite" aria-relevant="additions text">
      <article v-for="answer in thread.answers" :key="answer.answerID" class="exchange">
        <div class="author"><AppIcon name="person" /><strong>You</strong></div><p class="text">{{ answer.question }}</p>
        <div class="author"><AppIcon name="agent" /><strong>Sheldon</strong></div><p class="text answer">{{ answer.text || (terminal(answer) ? 'No answer text was saved.' : 'Reading the original change…') }}</p>
        <div class="statuses"><span>Execution: {{ answer.state }}</span><span v-if="terminal(answer)">Saving: {{ answer.persistence ?? 'unavailable' }}</span><span v-else>Submitted question saved · live output not yet saved</span><span v-if="answer.executionUnknown">Execution outcome unknown</span><span v-if="answer.stopRequested">Stop requested · acknowledgement is not completion</span></div>
      </article>
    </div>
    <div v-if="thread.answers.length" class="answer-actions"><AppButton v-if="!terminal(thread.answers.at(-1)!)" :disabled="thread.answers.at(-1)!.stopRequested" @click="q.action(thread, 'stop')">Stop this answer</AppButton><AppButton v-if="thread.answers.at(-1)!.persistence === 'failed'" @click="q.action(thread, 'save')">Retry saving</AppButton><AppButton v-if="thread.observationLost" @click="q.observe(thread)">Reconnect answer observation</AppButton></div>
    <StatusMessage v-if="thread.observationLost">Answer observation was disconnected. Reconnect only observes the original answer; it never resends the question.</StatusMessage>
    <StatusMessage v-if="thread.error" tone="error">{{ thread.error }}</StatusMessage>
    <p v-if="q.unavailable(thread)" class="unavailable">{{ thread.uncertain ? 'Admission is uncertain. Refresh saved history; do not resend.' : thread.session.state === 'unknown' ? 'Original execution is uncertain; continuation is unavailable.' : thread.session.state === 'unavailable' ? 'Continuation is unavailable until original-session or saving requirements are resolved.' : 'Another answer is active or still needs saving on this revision. Your follow-up draft stays editable.' }}</p>
    <QuestionComposer v-model="thread.draft" :sending="thread.sending" :unavailable="q.unavailable(thread)" @send="q.followup(thread)" />
  </section>
</template>

<style scoped>
.conversation { padding: 16px; background: var(--canvas); font: 12px/1.6 var(--sans); min-width: 0; overflow-wrap: anywhere; }
header { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; margin-bottom: 12px; }
.anchor { color: var(--accent); font: 10px/1.5 var(--mono); }
header > div { display: flex; gap: 4px; margin-left: auto; }
.older { color: var(--warning); font-size: 10px; }
.context { font-size: 10px; color: var(--muted); margin-bottom: 20px; }
.context p { font-family: var(--mono); }
.author { display: flex; align-items: center; gap: 8px; }
.author .icon { color: var(--accent); }
.text { white-space: pre-wrap; margin: 12px 0 20px; }
.answer { line-height: 1.8; }
.exchange + .exchange { margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border); }
.statuses { display: flex; flex-wrap: wrap; gap: 4px 12px; color: var(--muted); font-size: 10px; margin-bottom: 14px; }
.answer-actions { display: flex; flex-wrap: wrap; gap: 8px; margin: 12px 0; }
.unavailable { color: var(--muted); font-size: 11px; }
.message { margin: 10px 0; }
</style>
