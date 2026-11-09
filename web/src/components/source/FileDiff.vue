<script setup lang="ts">
import type { DiffFile } from '../../api/contracts/source'
import DiffHunk from './DiffHunk.vue'
import AppIcon from '../ui/AppIcon.vue'

defineProps<{ file: DiffFile; understood: boolean }>()
defineEmits<{ understood: [id: string] }>()
</script>

<template>
  <article class="file-diff" :aria-label="`Changed file ${file.newPath ?? file.oldPath}`">
    <header><h2 tabindex="-1" :title="file.newPath ?? file.oldPath">{{ file.newPath ?? file.oldPath }}</h2><button :aria-label="`${understood ? 'Unmark understood' : 'Mark understood'} ${file.newPath ?? file.oldPath}`" :aria-pressed="understood" @click="$emit('understood', file.id)"><AppIcon :name="understood ? 'checked' : 'circle'" />{{ understood ? 'Understood' : 'Mark understood' }}</button></header>
    <div v-if="file.oldPath && file.newPath && file.oldPath !== file.newPath" class="details">Renamed from {{ file.oldPath }}<span v-if="file.similarity"> · {{ file.similarity }}% similarity</span></div>
    <div v-if="file.oldMode !== file.newMode" class="details">Mode: {{ file.oldMode || 'none' }} → {{ file.newMode || 'none' }}</div>
    <div v-if="file.kind !== 'text'" class="details">{{ file.reason || 'No text diff is available for this change.' }}</div>
    <div class="patch"><DiffHunk v-for="hunk in file.hunks ?? []" :key="hunk.id" :hunk="hunk" /></div>
    <div v-if="file.kind === 'text' && !file.hunks?.length" class="details">No changed text lines.</div>
  </article>
</template>

<style scoped>
.file-diff { background: var(--paper); margin-bottom: 16px; scroll-margin-top: 0; }
.patch { overflow-x: auto; }
header { position: sticky; top: 0; z-index: 1; min-height: 32px; display: flex; align-items: center; gap: 16px; padding: 0 12px; border-bottom: 1px solid var(--border); background: var(--surface); }
h2 { font: 11px/1.5 var(--mono); margin: 0; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
button { border: 0; background: transparent; color: var(--muted); display: inline-flex; gap: 6px; align-items: center; padding: 4px; min-height: 28px; font-size: 10px; white-space: nowrap; }
button[aria-pressed='true'] { color: var(--accent); }
.details { padding: 12px; color: var(--muted); font-size: 11px; overflow-wrap: anywhere; }
@media (max-width: 760px), (pointer: coarse) { button { min-height: 44px; } }
</style>
