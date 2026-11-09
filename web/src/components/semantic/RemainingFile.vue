<script setup lang="ts">
import { ref } from 'vue'
import type { DiffFile, DiffLine } from '../../api/contracts/source'
import { useConversationContext } from '../../composables/useConversations'
import ChangedFileHeader from '../source/ChangedFileHeader.vue'
import SourceQuote from '../source/SourceQuote.vue'
import AppButton from '../ui/AppButton.vue'

const props = defineProps<{ file: DiffFile; lines: DiffLine[]; revisionId: string; matching: boolean; understood: boolean }>()
defineEmits<{ understood: [fileID: string] }>()
const rendered = ref(props.lines.length <= 200)
const q = useConversationContext()
</script>

<template><article class="remaining-file" :aria-label="`Remaining file ${file.newPath ?? file.oldPath}`"><ChangedFileHeader :file="file" :disabled="!matching" :understood="understood" @understood="$emit('understood', $event)"><AppButton variant="quiet" :disabled="!matching || !!q.draft.value" @click="q.openFile(file.id, revisionId)">View original file</AppButton></ChangedFileHeader><p v-if="file.kind !== 'text'">{{ file.reason || 'Non-text change. Inspect it in Files changed.' }}</p><template v-else><p>{{ lines.length ? `${lines.length} changed ${lines.length === 1 ? 'line is' : 'lines are'} not assigned to a group.` : 'All changed lines in this file are assigned to groups.' }}</p><SourceQuote v-if="rendered && lines.length" :lines="lines" :old-path="file.oldPath" :new-path="file.newPath" /><AppButton v-else-if="lines.length" @click="rendered = true">Render remaining lines {{ file.newPath ?? file.oldPath }}</AppButton></template></article></template>

<style scoped>
.remaining-file { margin-bottom: 16px; background: var(--paper); }
.remaining-file > p, .remaining-file > .button { margin: 12px 16px; font-size: 11px; color: var(--muted); }
.quote { margin: 12px 16px; }
</style>
