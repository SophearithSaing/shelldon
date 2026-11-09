<script setup lang="ts">
import { computed, nextTick, ref } from 'vue'
import type { SemanticGroup } from '../../api/contracts/generation'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import UnderstandingProgress from '../source/UnderstandingProgress.vue'
import { useReadingPosition } from '../../composables/useReadingPosition'

const props = defineProps<{ groups: SemanticGroup[]; selected: string; collapsed: boolean; visible: boolean; understood: number; total: number; percentage: number; remainder: number }>()
const emit = defineEmits<{ select: [id: string]; collapse: [] }>()
const toggle = ref<InstanceType<typeof AppButton> | null>(null)
const root = ref<HTMLElement | null>(null)
useReadingPosition(computed((): HTMLElement | null => root.value?.parentElement ?? null), computed((): boolean => props.visible && !props.collapsed))

/** Toggles the shared file/group rail while retaining focus. */
async function collapse(): Promise<void> { emit('collapse'); await nextTick(); (toggle.value?.$el as HTMLButtonElement | undefined)?.focus() }

/**
 * Counts each changed file once within a group.
 * @param group Original group.
 * @returns Unique file count.
 */
function fileCount(group: SemanticGroup): number { return new Set(group.ranges.map((range): string => range.fileID)).size }
</script>

<template><div ref="root" :class="['groups', { collapsed }]"><header><strong v-if="!collapsed">Review by intent <span>{{ groups.length }}</span></strong><AppButton ref="toggle" variant="quiet" :aria-label="collapsed ? 'Open groups panel' : 'Collapse groups panel'" :aria-expanded="!collapsed" @click="collapse"><AppIcon name="chevron" :class="collapsed ? 'right' : 'left'" /></AppButton></header><template v-if="!collapsed"><UnderstandingProgress :understood="understood" :total="total" :percentage="percentage" /><nav aria-label="Semantic groups"><button v-for="(group, index) in groups" :key="group.groupID" :aria-current="selected === group.groupID ? 'true' : undefined" :title="group.title" @click="$emit('select', group.groupID)"><span>{{ String(index + 1).padStart(2, '0') }}</span><div><strong>{{ group.title }}</strong><small>{{ fileCount(group) }} {{ fileCount(group) === 1 ? 'file' : 'files' }}</small></div></button><button :aria-current="selected === 'remainder' ? 'true' : undefined" @click="$emit('select', 'remainder')"><div><strong>Ungrouped changes</strong><small>{{ remainder }} changed lines · full inventory</small></div></button></nav><p>Groups organize reading. They are not a safety score or approval.</p></template><span v-else class="percentage">{{ percentage }}%</span></div></template>

<style scoped>
header { display: flex; align-items: center; justify-content: space-between; padding: 12px; gap: 4px; position: sticky; top: 0; z-index: 2; background: var(--canvas); }
header strong { font-size: 12px; }
header span { color: var(--muted); font-size: 10px; margin-left: 4px; }
nav { padding: 8px; }
nav button { display: flex; align-items: flex-start; gap: 10px; padding: 12px 8px; border: 1px solid transparent; border-radius: 6px; color: var(--ink); text-align: left; background: transparent; width: 100%; }
nav button[aria-current] { background: var(--accent-soft); border-left-color: var(--accent); }
nav button > span { font-size: 10px; color: var(--muted); padding-top: 2px; }
nav button > div { min-width: 0; }
nav strong { font-size: 12px; font-weight: 600; display: block; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
nav small { display: block; color: var(--muted); margin-top: 8px; font-size: 10px; }
p { color: var(--muted); font-size: 10px; padding: 12px; border-top: 1px solid var(--border); }
.collapsed header { justify-content: center; padding-inline: 0; }
.percentage { display: block; text-align: center; color: var(--muted); font-size: 10px; }
.right { transform: rotate(-90deg); }
.left { transform: rotate(90deg); }
@media (max-width: 760px) { .collapsed { display: flex; align-items: center; gap: 12px; padding-inline: 12px; } }
</style>
