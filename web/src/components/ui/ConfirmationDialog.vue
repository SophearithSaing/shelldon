<script setup lang="ts">
import { ref, watch } from 'vue'
import AppButton from './AppButton.vue'
const props = defineProps<{ open: boolean; title: string; description: string; confirmLabel: string }>()
defineEmits<{ confirm: []; cancel: [] }>()
const dialog = ref<HTMLDialogElement | null>(null)

/** Applies native modal focus/escape behavior without losing the triggering control. */
function sync(): void {
  if (props.open && !dialog.value?.open) dialog.value?.showModal()
  else if (!props.open && dialog.value?.open) dialog.value.close()
}

watch((): boolean => props.open, sync, { flush: 'post' })
</script>

<template><dialog ref="dialog" :aria-label="title" @cancel.prevent="$emit('cancel')"><h2>{{ title }}</h2><p>{{ description }}</p><footer><AppButton autofocus @click="$emit('cancel')">Keep current result</AppButton><AppButton variant="primary" @click="$emit('confirm')">{{ confirmLabel }}</AppButton></footer></dialog></template>

<style scoped>
dialog { width: min(480px, calc(100% - 32px)); padding: 24px; border: 1px solid var(--border-strong); border-radius: 12px; background: var(--paper); color: var(--ink); }
dialog::backdrop { background: #0008; }
h2 { font-size: 20px; margin: 0 0 12px; }
p { color: var(--muted); }
footer { display: flex; gap: 12px; justify-content: flex-end; flex-wrap: wrap; margin-top: 24px; }
</style>
