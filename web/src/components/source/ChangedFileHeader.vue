<script setup lang="ts">
import type { DiffFile } from '../../api/contracts/source'
import AppIcon from '../ui/AppIcon.vue'
defineProps<{ file: DiffFile; understood: boolean; disabled?: boolean }>()
defineEmits<{ understood: [id: string] }>()
</script>

<template><header class="file-header"><h2 tabindex="-1" :title="file.newPath ?? file.oldPath">{{ file.newPath ?? file.oldPath }}</h2><slot /><button :disabled="disabled" :aria-label="`${understood ? 'Unmark understood' : 'Mark understood'} ${file.newPath ?? file.oldPath}`" :aria-pressed="understood" @click="$emit('understood', file.id)"><AppIcon :name="understood ? 'checked' : 'circle'" />{{ understood ? 'Understood' : 'Mark understood' }}</button></header></template>

<style scoped>
.file-header { position: sticky; top: 0; z-index: 1; min-height: 32px; display: flex; align-items: center; gap: 12px; padding: 0 12px; border-bottom: 1px solid var(--border); background: var(--surface); }
h2 { font: 11px/1.5 var(--mono); margin: 0; flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
button { border: 0; background: transparent; color: var(--muted); display: inline-flex; gap: 6px; align-items: center; padding: 4px; min-height: 28px; font-size: 10px; white-space: nowrap; }
button[aria-pressed='true'] { color: var(--accent); }
button:disabled { opacity: .5; }
@media (max-width: 760px), (pointer: coarse) { button { min-height: 44px; } }
</style>
