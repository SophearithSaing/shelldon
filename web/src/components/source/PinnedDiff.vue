<script setup lang="ts">
import { nextTick, onBeforeUnmount, ref, toRef, watch } from 'vue'
import type { SourceDiff } from '../../api/contracts/source'
import FileDiff from './FileDiff.vue'
import LazyFile from './LazyFile.vue'
import type { Anchor } from '../../api/contracts/questions'
import { useReadingPosition } from '../../composables/useReadingPosition'

const props = defineProps<{ source: SourceDiff; understood: Set<string>; visible: boolean }>()
const emit = defineEmits<{ active: [id: string]; understood: [id: string] }>()
const viewport = ref<HTMLElement | null>(null)
useReadingPosition(viewport, toRef(props, 'visible'))
const requested = ref('')
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
 * @param anchor Optional exact original range.
 */
async function jump(fileID: string, anchor?: Anchor): Promise<void> {
  requested.value = fileID
  await nextTick()
  const section = viewport.value?.querySelector<HTMLElement>(`[data-file="${fileID}"]`)
  if (!section) return
  section.scrollIntoView({ block: 'start' })
  section.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
  if (anchor?.kind === 'lines') {
    const file = props.source.files.find((item): boolean => item.id === fileID)
    const line = file?.hunks?.find((hunk): boolean => hunk.id === anchor.hunkID)?.lines.find((item): boolean => (anchor.side === 'old' ? item.oldLine : item.newLine) === anchor.start)
    if (line) section.querySelector<HTMLElement>(`[data-line="${line.id}"]`)?.scrollIntoView({ block: 'center' })
  }
  emit('active', fileID)
}

watch((): string => props.source.revisionID, async (): Promise<void> => { await nextTick(); updateActive() })
onBeforeUnmount((): void => cancelAnimationFrame(frame))
/**
 * Restores focus to an explicitly revealed composer without changing its draft.
 * @param fileID Owning file.
 * @param threadID Existing inline thread, or the retained initial composer.
 */
function focusComposer(fileID: string, threadID?: string): void {
  const file = viewport.value?.querySelector<HTMLElement>(`[data-file="${fileID}"]`)
  file?.querySelector<HTMLTextAreaElement>(threadID ? `[data-thread="${threadID}"] textarea` : '.initial-question textarea')?.focus({ preventScroll: true })
}

defineExpose({ jump, focusComposer })
</script>

<template>
  <div ref="viewport" class="pinned-diff" aria-label="Pinned unified diff" @scroll.passive="onScroll"><p v-if="!source.files.length" class="empty">No changed files in this comparison.</p><div v-for="(file, index) in source.files" :key="file.id" :data-file="file.id"><LazyFile :file="file" :root="viewport" :eager="index < 2" :forced="requested === file.id" :understood="understood.has(file.id)" @understood="$emit('understood', $event)"><FileDiff :file="file" :revision-id="source.revisionID" questions :understood="understood.has(file.id)" @understood="$emit('understood', $event)" /></LazyFile></div></div>
</template>

<style scoped>
.pinned-diff { flex: 1; min-height: 0; overflow: auto; scrollbar-gutter: stable; }
.empty { padding: 32px; color: var(--muted); }
@media (max-width: 760px) { .pinned-diff { flex: none; max-height: 70dvh; min-height: 300px; } }
</style>
