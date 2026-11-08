<script setup lang="ts">
import { computed } from 'vue'
import UiField from './ui/UiField.vue'

const props = defineProps<{
  files: readonly { id: string; path: string }[]
  current: string
  counts: Record<string, number>
  viewed: Record<string, boolean>
  real?: boolean
}>()
const search = defineModel<string>({ default: '' })
const emit = defineEmits<{ select: [id: string] }>()

/**
 * Groups matching paths without changing their source order.
 * @returns Directory groups containing the visible files.
 */
function groups(): { path: string; files: { id: string; path: string }[] }[] {
  const result: { path: string; files: { id: string; path: string }[] }[] = []
  for (const file of props.files) {
    if (!file.path.toLowerCase().includes(search.value.trim().toLowerCase())) continue
    const slash = file.path.lastIndexOf('/')
    const path = slash < 0 ? '' : file.path.slice(0, slash)
    let group = result.find((item): boolean => item.path === path)
    if (!group) {
      group = { path, files: [] }
      result.push(group)
    }
    group.files.push(file)
  }
  return result
}
const visibleGroups = computed(groups)
</script>

<template>
  <UiField v-model="search" :label="real ? 'Find a changed file' : 'Find a sample file'" type="search" placeholder="Find a file…" />
  <nav class="changed-file-tree" :aria-label="real ? 'Changed file selection' : 'Sample file selection'">
    <div v-for="group in visibleGroups" :key="group.path" class="file-group">
      <p class="folder">⌄ <span>{{ group.path.replaceAll('/', ' / ') || 'Repository root' }}</span></p>
      <button v-for="file in group.files" :key="file.id" type="button" :aria-label="file.path" :aria-current="current === file.id ? 'true' : undefined" @click="emit('select', file.id)">
        <span aria-hidden="true">▱</span><span class="file-name">{{ file.path.slice(file.path.lastIndexOf('/') + 1) }}</span>
        <span v-if="counts[file.id]" class="file-count" :aria-label="`${counts[file.id]} ${real ? 'runtime' : 'sample'} questions`">{{ counts[file.id] }}</span>
        <span v-else-if="viewed[file.id]" class="viewed-icon" aria-label="Understood">✓</span>
      </button>
    </div>
    <p v-if="visibleGroups.length === 0" role="status">{{ real ? 'No changed paths match.' : 'No sample paths match.' }}</p>
  </nav>
</template>

<style scoped>
.changed-file-tree { margin-top: var(--space-4); }
.file-group + .file-group { margin-top: var(--space-3); }
.folder { display: flex; align-items: center; gap: var(--space-2); min-height: 2.125rem; padding-inline: var(--space-2); color: var(--color-muted); font-size: var(--text-small); }
.changed-file-tree button { display: flex; align-items: center; gap: 0.4375rem; width: 100%; min-height: var(--target-control); padding: var(--space-2); border: 0; border-left: 2px solid transparent; border-radius: var(--radius-control); background: transparent; text-align: left; font-size: var(--text-small); }
.changed-file-tree button:hover { background: var(--color-surface); }
.changed-file-tree button[aria-current] { border-left-color: var(--color-accent); background: var(--color-accent-soft); }
.file-name { min-width: 0; overflow-wrap: anywhere; }
.file-count { margin-left: auto; padding-inline: 0.3125rem; background: var(--color-panel); color: var(--color-accent); border-radius: 0.25rem; font-size: 0.625rem; }
.viewed-icon { margin-left: auto; color: var(--color-success); }
</style>
