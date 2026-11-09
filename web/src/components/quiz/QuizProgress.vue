<script setup lang="ts">
defineProps<{ total: number; current: number; checked: string[] }>()
defineEmits<{ select: [index: number] }>()
</script>

<template><nav class="quiz-progress" aria-label="Quiz questions"><button v-for="index in total" :key="index" :aria-label="`Question ${index}${checked.includes(`q${index}`) ? ', checked' : ''}`" :aria-current="current === index - 1 ? 'step' : undefined" :class="{ checked: checked.includes(`q${index}`) }" @click="$emit('select', index - 1)"><span /></button></nav></template>

<style scoped>
.quiz-progress { display: flex; gap: 6px; margin-bottom: 20px; }
button { flex: 1; min-width: 20px; padding: 10px 0; border: 0; background: transparent; }
button span { display: block; height: 3px; background: var(--border); border-radius: 3px; }
button.checked span { background: var(--muted); }
button[aria-current] span { background: var(--accent); }
</style>
