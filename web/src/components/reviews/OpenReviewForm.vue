<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { openReview } from '../../api/reviews'
import { errorMessage } from '../../api/client'
import AppButton from '../ui/AppButton.vue'
import StatusMessage from '../ui/StatusMessage.vue'

const emit = defineEmits<{ opened: [route: string] }>()
const props = withDefaults(defineProps<{ welcome?: boolean; autofocus?: boolean }>(), { welcome: false, autofocus: false })
const input = ref<HTMLInputElement | null>(null)
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
onMounted((): void => { if (props.autofocus) input.value?.focus() })
</script>

<template>
  <section class="open-review" :class="{ welcome }" aria-label="PR registration">
    <template v-if="welcome"><span class="eyebrow">READ. ASK. UNDERSTAND.</span>
    <h2>Slow down.<br /><span>Understand the changes.</span></h2>
    <p>Bring a pull request. Explore the changes, ask at the source, and build your understanding.</p></template>
    <form @submit.prevent="submit">
      <label for="pr-url">Open a pull request</label>
      <div class="input-row"><input id="pr-url" ref="input" v-model="url" type="url" required placeholder="https://github.com/owner/repo/pull/123" :disabled="pending" /><AppButton type="submit" variant="primary" :disabled="pending">{{ pending ? 'Opening…' : 'Open PR' }}</AppButton></div>
    </form>
    <StatusMessage v-if="error" tone="error">{{ error }}</StatusMessage>
  </section>
</template>

<style scoped>
.open-review { padding: 20px; margin-bottom: 24px; border: 1px solid var(--border); border-radius: 9px; background: var(--paper); }
.welcome { padding: clamp(24px, 5vw, 64px); }
.welcome form { max-width: 660px; }
.eyebrow { color: var(--accent); font-size: 10px; font-weight: 700; letter-spacing: 2px; }
h2 { font-size: clamp(30px, 4vw, 48px); line-height: 1.12; letter-spacing: -1.5px; margin: 20px 0; font-weight: 650; }
h2 span { color: var(--accent); }
p { max-width: 480px; color: var(--muted); font-size: 15px; margin-bottom: 36px; }
form { margin: 0; }
label { display: block; font-weight: 600; margin-bottom: 10px; }
.input-row { display: flex; gap: 10px; }
input { min-width: 0; flex: 1; min-height: 40px; border: 1px solid var(--border-strong); border-radius: 6px; padding: 8px 12px; background: var(--paper); color: var(--ink); }
@media (max-width: 500px) { .input-row { flex-direction: column; } }
</style>
