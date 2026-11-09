<script setup lang="ts">
export type Feature = 'overview' | 'files' | 'questions' | 'quiz' | 'semantic'
defineProps<{ selected: Feature; fileCount?: number; quizCount?: number; semanticCount?: number }>()
defineEmits<{ select: [feature: Feature] }>()
const features: { id: Feature; label: string }[] = [{ id: 'overview', label: 'Overview' }, { id: 'files', label: 'Files changed' }, { id: 'questions', label: 'Questions' }, { id: 'quiz', label: 'Quiz' }, { id: 'semantic', label: 'Semantic review' }]
</script>

<template>
  <nav class="features" aria-label="Review features"><button v-for="feature in features" :key="feature.id" :aria-current="selected === feature.id ? 'page' : undefined" @click="$emit('select', feature.id)">{{ feature.label }}<span v-if="feature.id === 'files' && fileCount !== undefined">{{ fileCount }}</span><span v-if="feature.id === 'quiz' && quizCount !== undefined">{{ quizCount }}</span><span v-if="feature.id === 'semantic' && semanticCount !== undefined">{{ semanticCount }}</span></button></nav>
</template>

<style scoped>
.features { display: flex; align-items: stretch; gap: 16px; padding: 0 16px; border-bottom: 1px solid var(--border); background: var(--paper); overflow-x: auto; flex-shrink: 0; }
button { min-height: 32px; display: flex; align-items: center; gap: 10px; padding: 0 3px; border: 0; border-bottom: 2px solid transparent; background: transparent; color: var(--muted); white-space: nowrap; font-size: 12px; }
button[aria-current] { color: var(--accent); border-bottom-color: var(--accent); font-weight: 650; }
button span { font-size: 10px; color: var(--muted); }
@media (max-width: 760px), (pointer: coarse) { button { min-height: 44px; } }
</style>
