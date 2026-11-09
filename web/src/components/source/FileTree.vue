<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { DiffFile } from '../../api/contracts/source'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import UnderstandingProgress from './UnderstandingProgress.vue'
import { useReadingPosition } from '../../composables/useReadingPosition'

const props = defineProps<{ files: DiffFile[]; active: string; understood: Set<string>; percentage: number; collapsed: boolean; visible: boolean }>()
const emit = defineEmits<{ select: [id: string]; collapse: [] }>()
const filter = ref('')
const toggle = ref<InstanceType<typeof AppButton> | null>(null)
const root = ref<HTMLElement | null>(null)
useReadingPosition(computed((): HTMLElement | null => root.value?.parentElement ?? null), computed((): boolean => props.visible && !props.collapsed))
const visible = computed((): DiffFile[] => props.files.filter((file): boolean => (file.newPath ?? file.oldPath ?? '').toLowerCase().includes(filter.value.toLowerCase())))

/** Toggles the file rail and retains keyboard focus on its control. */
async function collapse(): Promise<void> {
  emit('collapse')
  await nextTick()
  ;(toggle.value?.$el as HTMLButtonElement | undefined)?.focus()
}
</script>

<template>
  <div ref="root" class="file-tree" :class="{ collapsed }">
    <header><strong v-if="!collapsed">Files changed <span>{{ files.length }}</span></strong><AppButton ref="toggle" variant="quiet" :aria-label="collapsed ? 'Open files panel' : 'Collapse files panel'" :aria-expanded="!collapsed" @click="collapse"><AppIcon name="chevron" :class="collapsed ? 'right' : 'left'" /></AppButton></header>
    <template v-if="!collapsed"><UnderstandingProgress :understood="understood.size" :total="files.length" :percentage="percentage" /><label class="filter"><span>Filter files</span><input v-model="filter" type="search" placeholder="Filter files…" /></label><nav aria-label="Changed files"><button v-for="file in visible" :key="file.id" :title="file.newPath ?? file.oldPath" :aria-current="active === file.id ? 'true' : undefined" @click="$emit('select', file.id)"><AppIcon :name="understood.has(file.id) ? 'checked' : 'circle'" /><span class="path">{{ file.newPath ?? file.oldPath }}</span><span class="change">{{ file.status === 'modified' ? 'M' : file.status === 'added' ? 'A' : file.status === 'deleted' ? 'D' : file.status }}</span></button><p v-if="!visible.length">No matching files.</p></nav></template>
    <span v-else class="rail-progress" title="Self-reported file understanding">{{ percentage }}%</span>
  </div>
</template>

<style scoped>
header { display: flex; align-items: center; justify-content: space-between; gap: 4px; padding: 12px; position: sticky; top: 0; z-index: 2; background: var(--canvas); }
header strong { font-size: 12px; white-space: nowrap; }
header strong span { color: var(--muted); font-size: 10px; margin-left: 5px; }
.filter { display: block; margin: 12px; }
.filter span { display: block; font-size: 10px; color: var(--muted); margin-bottom: 5px; }
input { min-width: 0; width: 100%; border: 1px solid var(--border); border-radius: 5px; background: var(--paper); color: var(--ink); padding: 5px 8px; font-size: 11px; }
nav { padding: 4px 8px; }
nav button { width: 100%; display: flex; align-items: center; gap: 8px; padding: 9px 7px; border: 0; border-radius: 6px; background: transparent; text-align: left; color: var(--muted); }
nav button[aria-current] { background: var(--accent-soft); color: var(--accent); }
.path { font-family: var(--mono); font-size: 10px; min-width: 0; flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.change { font-family: var(--mono); font-size: 9px; }
.right { transform: rotate(-90deg); }
.left { transform: rotate(90deg); }
nav p { color: var(--muted); padding: 8px; font-size: 11px; }
.collapsed header { justify-content: center; padding: 12px 0; }
.rail-progress { display: block; text-align: center; font-size: 10px; color: var(--muted); }
@media (max-width: 760px) { .collapsed { display: flex; align-items: center; gap: 12px; padding: 0 12px; } nav button { min-height: 44px; } }
</style>
