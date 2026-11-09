<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import type { DiffFile } from '../../api/contracts/source'
import AppButton from '../ui/AppButton.vue'
import ChangedFileHeader from './ChangedFileHeader.vue'

const props = defineProps<{ file: DiffFile; root: HTMLElement | null; forced: boolean; eager: boolean; understood: boolean }>()
defineEmits<{ understood: [id: string] }>()
const element = ref<HTMLElement | null>(null)
const rendered = ref(props.eager || props.forced || props.file.kind !== 'text')
const estimate = computed((): number => Math.max(120, (props.file.hunks ?? []).reduce((height, hunk): number => height + 32 + hunk.lines.length * 27, 48)))
let observer: IntersectionObserver | null = null

/** Mounts literal source once and retains it for the remainder of this page visit. */
function render(): void { rendered.value = true; observer?.disconnect() }

/** Observes file proximity without truncating inventory or fetching source. */
function observe(): void {
  observer?.disconnect()
  if (rendered.value || !element.value) return
  if (!globalThis.IntersectionObserver) { render(); return }
  observer = new IntersectionObserver((entries): void => { if (entries.some((entry): boolean => entry.isIntersecting)) render() }, { root: props.root, rootMargin: '800px 0px' })
  observer.observe(element.value)
}

watch((): boolean => props.forced, (forced): void => { if (forced) render() })
watch((): HTMLElement | null => props.root, observe, { flush: 'post' })
onMounted(observe)
onBeforeUnmount((): void => observer?.disconnect())
</script>

<template><div ref="element"><slot v-if="rendered" /><article v-else class="placeholder" :style="{ minHeight: `${estimate}px` }" :aria-label="`Changed file ${file.newPath ?? file.oldPath}`"><ChangedFileHeader :file="file" :understood="understood" @understood="$emit('understood', $event)" /><div><AppButton @click="render">Render diff {{ file.newPath ?? file.oldPath }}</AppButton></div></article></div></template>

<style scoped>
.placeholder { margin-bottom: 16px; background: var(--paper); }
.placeholder > div { padding: 20px; }
</style>
