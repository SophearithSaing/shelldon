<script setup lang="ts">
import type { DiffLine } from '../../api/contracts/source'
defineProps<{ lines: DiffLine[]; label?: string }>()
</script>

<template><div class="quote" :aria-label="label ?? 'Original source quote'"><div v-for="line in lines" :key="line.id" :class="['row', { added: line.sign === '+', removed: line.sign === '-' }]"><span aria-hidden="true">{{ line.oldLine ?? '' }}</span><span aria-hidden="true">{{ line.newLine ?? '' }}</span><span aria-hidden="true">{{ line.sign }}</span><code>{{ line.text }}</code></div></div></template>

<style scoped>
.quote { overflow: auto; max-height: 340px; background: var(--paper); border: 1px solid var(--border); border-radius: 6px; font: 10px/24px var(--mono); }
.row { display: flex; min-width: max-content; }
.row > span { flex: 0 0 32px; text-align: right; padding-right: 6px; color: var(--muted); user-select: none; }
.row > span:nth-child(3) { flex-basis: 20px; }
code { white-space: pre; padding-right: 12px; font: inherit; }
.added { background: var(--added-bg); }
.removed { background: var(--removed-bg); }
</style>
