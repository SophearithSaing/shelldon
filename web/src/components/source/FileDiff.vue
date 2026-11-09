<script setup lang="ts">
import type { DiffFile } from '../../api/contracts/source'
import DiffHunk from './DiffHunk.vue'
import QuestionHunk from '../conversations/QuestionHunk.vue'
import ChangedFileHeader from './ChangedFileHeader.vue'

defineProps<{ file: DiffFile; understood: boolean; revisionId?: string; questions?: boolean }>()
defineEmits<{ understood: [id: string] }>()
</script>

<template>
  <article class="file-diff" :aria-label="`Changed file ${file.newPath ?? file.oldPath}`">
    <ChangedFileHeader :file="file" :understood="understood" @understood="$emit('understood', $event)" />
    <div v-if="file.oldPath && file.newPath && file.oldPath !== file.newPath" class="details">Renamed from {{ file.oldPath }}<span v-if="file.similarity"> · {{ file.similarity }}% similarity</span></div>
    <div v-if="file.oldMode !== file.newMode" class="details">Mode: {{ file.oldMode || 'none' }} → {{ file.newMode || 'none' }}</div>
    <div v-if="file.kind !== 'text'" class="details">{{ file.reason || 'No text diff is available for this change.' }}</div>
    <div class="patch"><template v-for="hunk in file.hunks ?? []" :key="hunk.id"><QuestionHunk v-if="questions && revisionId" :hunk="hunk" :file-id="file.id" :revision-id="revisionId" :old-path="file.oldPath" :new-path="file.newPath" /><DiffHunk v-else :hunk="hunk" :old-path="file.oldPath" :new-path="file.newPath" /></template></div>
    <div v-if="file.kind === 'text' && !file.hunks?.length" class="details">No changed text lines.</div>
  </article>
</template>

<style scoped>
.file-diff { background: var(--paper); margin-bottom: 16px; scroll-margin-top: 0; }
.patch { overflow-x: auto; }
.details { padding: 12px; color: var(--muted); font-size: 11px; overflow-wrap: anywhere; }
</style>
