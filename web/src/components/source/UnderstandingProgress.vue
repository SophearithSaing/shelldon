<script setup lang="ts">
defineProps<{ understood: number; total: number; percentage: number }>()
</script>

<template>
  <section class="understanding" aria-label="Self-reported understanding"><div class="title"><span>Understanding</span><strong>{{ percentage }}%</strong></div><progress aria-label="Files marked understood" :value="understood" :max="total || 1" /><p>{{ understood }} of {{ total }} files understood</p></section>
</template>

<style scoped>
.understanding { margin: 12px; padding-bottom: 16px; border-bottom: 1px solid var(--border); color: var(--muted); font-size: 11px; }
.title { display: flex; justify-content: space-between; gap: 8px; }
strong { color: var(--ink); }
progress { display: block; width: 100%; height: 3px; margin-top: 10px; border: 0; appearance: none; background: var(--border); }
progress::-webkit-progress-bar { background: var(--border); }
progress::-webkit-progress-value { background: var(--accent); }
progress::-moz-progress-bar { background: var(--accent); }
p { margin: 8px 0 0; font-size: 10px; }
</style>
