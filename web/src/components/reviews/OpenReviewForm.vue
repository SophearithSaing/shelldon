<script setup lang="ts">
import { onBeforeUnmount, ref } from 'vue'
import { openReview } from '../../api/reviews'
import { errorMessage } from '../../api/client'
import AppButton from '../ui/AppButton.vue'
import StatusMessage from '../ui/StatusMessage.vue'

const emit = defineEmits<{ opened: [route: string] }>()
const url = ref('')
const pending = ref(false)
const error = ref('')
const controller = new AbortController()

/** Registers a PR without fetching its source or starting inference. */
async function submit(): Promise<void> {
  if (pending.value) return
  pending.value = true
  error.value = ''
  try {
    const result = await openReview(url.value.trim(), controller.signal)
    if (!controller.signal.aborted) emit('opened', result.route)
  } catch (cause) {
    if (!controller.signal.aborted) error.value = errorMessage(cause)
  } finally {
    pending.value = false
  }
}

onBeforeUnmount((): void => controller.abort())
</script>

<template>
  <section class="open-review">
    <span class="eyebrow">READ. ASK. UNDERSTAND.</span>
    <h1>Slow down.<br /><span>Understand the changes.</span></h1>
    <p>Bring a pull request. Explore the changes, ask at the source, and build your understanding.</p>
    <form @submit.prevent="submit">
      <label for="pr-url">Open a pull request</label>
      <div class="input-row"><input id="pr-url" v-model="url" type="url" required placeholder="https://github.com/owner/repo/pull/123" :disabled="pending" /><AppButton type="submit" variant="primary" :disabled="pending">{{ pending ? 'Opening…' : 'Open PR' }}</AppButton></div>
    </form>
    <StatusMessage v-if="error" tone="error">{{ error }}</StatusMessage>
  </section>
</template>

<style scoped>
.open-review { width: min(100% - 40px, 660px); margin: 72px auto 32px; }
.eyebrow { color: var(--accent); font-size: 10px; font-weight: 700; letter-spacing: 2px; }
h1 { font-size: clamp(30px, 4vw, 48px); line-height: 1.12; letter-spacing: -1.5px; margin: 20px 0; font-weight: 650; }
h1 span { color: var(--accent); }
p { max-width: 480px; color: var(--muted); font-size: 15px; margin-bottom: 36px; }
form { margin-bottom: 16px; }
label { display: block; font-weight: 600; margin-bottom: 10px; }
.input-row { display: flex; gap: 10px; }
input { min-width: 0; flex: 1; min-height: 40px; border: 1px solid var(--border-strong); border-radius: 6px; padding: 8px 12px; background: var(--paper); color: var(--ink); }
@media (max-width: 500px) { .input-row { flex-direction: column; } .open-review { margin-top: 40px; } }
</style>
