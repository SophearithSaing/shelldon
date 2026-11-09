<script setup lang="ts">
import { useConversationContext } from '../../composables/useConversations'
import { referenceLabel } from '../../api/selection'
import AppButton from '../ui/AppButton.vue'
const q = useConversationContext()
</script>

<template><div v-if="q.draft.value" class="draft-notice" role="status"><span>Question pinned to {{ referenceLabel(q.draft.value.context) }}</span><AppButton variant="quiet" @click="q.resume">Resume question</AppButton><AppButton variant="quiet" :disabled="q.draft.value.sending" @click="q.discard">Discard draft</AppButton></div></template>

<style scoped>
.draft-notice { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; padding: 6px 16px; border-bottom: 1px solid var(--border); background: var(--surface); font-size: 11px; }
.draft-notice > span { flex: 1; overflow-wrap: anywhere; color: var(--muted); }
</style>
