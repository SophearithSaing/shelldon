<script setup lang="ts">
import type { Evidence } from '../../api/contracts/generation'
import { useConversationContext } from '../../composables/useConversations'
import { computed } from 'vue'
import type { SourceReference } from '../../api/contracts/questions'
import { referenceLabel } from '../../api/selection'
import AppButton from '../ui/AppButton.vue'
import SourceQuote from './SourceQuote.vue'

const props = defineProps<{ evidence: Evidence; revisionId: string }>()
const q = useConversationContext()
const reference = computed((): SourceReference => ({ revisionID: props.revisionId, anchor: { kind: 'lines', ...props.evidence.anchor }, oldPath: props.evidence.oldPath, newPath: props.evidence.newPath }))
</script>

<template><section class="evidence"><header><span>{{ referenceLabel(reference) }}</span><AppButton variant="quiet" :disabled="!q.matching(reference) || !!q.draft.value" @click="q.navigate(reference)">View in original diff</AppButton></header><SourceQuote :lines="evidence.selected" :context-lines="evidence.surrounding?.lines" :old-path="evidence.oldPath" :new-path="evidence.newPath" /></section></template>

<style scoped>
.evidence { margin-top: 16px; }
header { display: flex; gap: 12px; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
header span { font: 10px/1.5 var(--mono); color: var(--muted); overflow-wrap: anywhere; }
</style>
