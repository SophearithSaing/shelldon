<script setup lang="ts">
import { computed } from 'vue'

const props = defineProps<{ files: readonly { id: string }[]; understood: Record<string, boolean> }>()
const count = computed((): number => props.files.filter((file): boolean => props.understood[file.id] === true).length)
const percentage = computed((): number => props.files.length ? Math.round(100 * count.value / props.files.length) : 0)
</script>

<template>
  <section class="understanding" aria-label="Self-reported file understanding">
    <div><span>Understanding</span><strong>{{ percentage }}%</strong></div>
    <progress :value="count" :max="files.length || 1" aria-label="Files marked understood" />
    <p>{{ count }} of {{ files.length }} files understood</p>
    <span class="sr-only">Self-reported page-memory progress, not code safety or PR approval.</span>
  </section>
</template>

<style scoped>
.understanding { padding: var(--space-4) var(--space-3); color: var(--color-muted); font-size: var(--text-small); border-bottom: 1px solid var(--color-border); }
.understanding div { display: flex; justify-content: space-between; gap: var(--space-2); }
progress { display: block; width: 100%; height: 0.25rem; margin-block: var(--space-3); accent-color: var(--color-accent); }
</style>
