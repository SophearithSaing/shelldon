<script setup lang="ts">
import { computed, onMounted, ref, useId } from 'vue'
import AppButton from '../ui/AppButton.vue'

const props = withDefaults(defineProps<{ modelValue: string; initial?: boolean; unavailable?: boolean; sending?: boolean; autofocus?: boolean }>(), { initial: false, unavailable: false, sending: false, autofocus: false })
const emit = defineEmits<{ 'update:modelValue': [text: string]; send: []; cancel: [] }>()
const field = ref<HTMLTextAreaElement | null>(null)
const id = useId()
const bytes = computed((): number => new TextEncoder().encode(props.modelValue).length)
const disabled = computed((): boolean => props.unavailable || props.sending || !props.modelValue.trim() || bytes.value > 16384)

/**
 * Applies the distinct initial/follow-up keyboard contracts without submitting IME composition.
 * @param event Textarea keyboard event.
 */
function keydown(event: KeyboardEvent): void {
  if (event.isComposing || event.key !== 'Enter') return
  if (props.initial ? !(event.ctrlKey || event.metaKey) : event.shiftKey) return
  event.preventDefault()
  if (!disabled.value) emit('send')
}

/**
 * Shares edits with the owning canonical draft.
 * @param event Textarea input event.
 */
function input(event: Event): void { emit('update:modelValue', (event.target as HTMLTextAreaElement).value) }

onMounted((): void => { if (props.autofocus) field.value?.focus() })
</script>

<template>
  <form class="composer" @submit.prevent="!disabled && $emit('send')">
    <textarea :id="id" ref="field" :value="modelValue" :aria-label="initial ? 'Your question' : 'Follow up in this thread'" :placeholder="initial ? 'What would you like to understand about this change?' : 'Ask a follow-up…'" :readonly="initial && sending" rows="3" @input="input" @keydown="keydown" />
    <p v-if="bytes > 16384" class="limit" role="alert">Question exceeds the 16 KiB text limit.</p>
    <footer><span>{{ initial ? 'Ctrl / ⌘ + Enter to send' : 'Enter to send · Shift + Enter for a newline' }}</span><div><AppButton v-if="initial" variant="quiet" :disabled="sending" @click="$emit('cancel')">Cancel</AppButton><AppButton variant="primary" type="submit" :disabled="disabled">{{ sending ? 'Sending…' : initial ? 'Send question' : 'Send follow-up' }}</AppButton></div></footer>
  </form>
</template>

<style scoped>
.composer { border: 1px solid var(--border-strong); border-radius: 9px; background: var(--paper); padding: 10px; }
.composer:focus-within { border-color: var(--accent); box-shadow: 0 0 0 2px var(--focus); }
textarea { display: block; resize: vertical; min-height: 72px; width: 100%; border: 0; outline: none; box-shadow: none; padding: 4px; background: transparent; color: var(--ink); font-size: 12px; line-height: 1.6; }
textarea:focus { outline: none; box-shadow: none; }
footer { display: flex; gap: 12px; justify-content: space-between; align-items: center; margin-top: 8px; }
footer > span { font-size: 9px; color: var(--muted); }
footer > div { display: flex; gap: 6px; margin-left: auto; }
.limit { color: var(--removed); font-size: 11px; }
@media (max-width: 500px) { footer { flex-wrap: wrap; } }
</style>
