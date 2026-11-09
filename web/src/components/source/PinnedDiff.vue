<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { SourceDiff } from '../../api/contracts/source'
import FileDiff from './FileDiff.vue'

const props = defineProps<{ source: SourceDiff; understood: Set<string> }>()
const emit = defineEmits<{ active: [id: string]; understood: [id: string] }>()
const viewport = ref<HTMLElement | null>(null)
let frame = 0

/** Tracks the first visible file without fetching or modifying source. */
function updateActive(): void {
  frame = 0
  const root = viewport.value
  if (!root) return
  const top = root.getBoundingClientRect().top
  let current = props.source.files[0]?.id ?? ''
  for (const section of root.querySelectorAll<HTMLElement>('[data-file]')) {
    if (section.getBoundingClientRect().top > top + 36) break
    current = section.dataset.file!
  }
  emit('active', current)
}

/** Coalesces passive scroll work into one animation frame. */
function onScroll(): void {
  if (!frame) frame = requestAnimationFrame(updateActive)
}

/**
 * Jumps to a file and focuses its heading without loading source.
 * @param fileID Target changed file identity.
 */
async function jump(fileID: string): Promise<void> {
  await nextTick()
  const section = viewport.value?.querySelector<HTMLElement>(`[data-file="${fileID}"]`)
  if (!section) return
  section.scrollIntoView({ block: 'start' })
  section.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
  emit('active', fileID)
}

watch((): string => props.source.revisionID, async (): Promise<void> => { await nextTick(); updateActive() })
onBeforeUnmount((): void => cancelAnimationFrame(frame))
defineExpose({ jump })
</script>

<template>
  <div ref="viewport" class="pinned-diff" aria-label="Pinned unified diff" @scroll.passive="onScroll"><p v-if="!source.files.length" class="empty">No changed files in this comparison.</p><div v-for="file in source.files" :key="file.id" :data-file="file.id"><FileDiff :file="file" :understood="understood.has(file.id)" @understood="$emit('understood', $event)" /></div></div>
</template>

<style scoped>
.pinned-diff { flex: 1; min-height: 0; overflow: auto; scrollbar-gutter: stable; }
.empty { padding: 32px; color: var(--muted); }
@media (max-width: 760px) { .pinned-diff { flex: none; max-height: 70dvh; min-height: 300px; } }
</style>
