<script setup lang="ts">
import { computed, ref } from 'vue'
import type { GenerationStatus } from '../../api/contracts/generation'
import { generationActive } from '../../composables/useGeneration'
import quizMascot from '../../assets/mascot-quiz.png'
import semanticMascot from '../../assets/mascot-semantic-review.png'
import AppButton from '../ui/AppButton.vue'
import StatusMessage from '../ui/StatusMessage.vue'
import ConfirmationDialog from '../ui/ConfirmationDialog.vue'

const props = defineProps<{ kind: 'quiz' | 'semantic'; hasResult: boolean; sourceAvailable: boolean; older: boolean; busy: boolean; pending: boolean; blocked: boolean; canGenerate: boolean; status: GenerationStatus | null; error: string }>()
const emit = defineEmits<{ generate: []; cancel: []; refresh: []; source: [] }>()
const confirming = ref(false)
const name = computed((): string => props.kind === 'quiz' ? 'quiz' : 'semantic review')

/** Confirms replacement only when a complete saved result already exists. */
function generate(): void { if (props.hasResult) confirming.value = true; else emit('generate') }

/** Admits one explicit replacement after confirmation. */
function replace(): void { confirming.value = false; emit('generate') }
</script>

<template>
  <section class="generation-panel" :class="{ ready: hasResult }">
    <header><h2 v-if="hasResult">{{ kind === 'quiz' ? 'Know what you’re reviewing.' : 'Review by intent' }}</h2><div><AppButton :disabled="pending" @click="$emit('refresh')">Refresh saved {{ name }}</AppButton><AppButton v-if="hasResult && !busy" :disabled="!canGenerate" @click="generate">Regenerate {{ name }}</AppButton><AppButton v-if="busy" :disabled="!generationActive(status) || status?.cancelRequested" @click="$emit('cancel')">{{ !generationActive(status) ? 'Starting generation…' : status?.cancelRequested ? 'Cancellation requested' : 'Cancel generation' }}</AppButton></div></header>
    <StatusMessage v-if="error" tone="error">{{ error }}</StatusMessage>
    <StatusMessage v-if="pending">Reading saved {{ name }}…</StatusMessage>
    <StatusMessage v-if="blocked">Generation or saving is uncertain. Refresh saved state explicitly before another mutation. No question will be replayed.</StatusMessage>
    <StatusMessage v-if="hasResult && older" title="Earlier revision">This result retains its original source. Refreshing source does not retarget it.</StatusMessage>
    <div v-if="status" class="generation-status" role="status">{{ busy ? 'Generation' : 'Last generation' }}: {{ busy && !generationActive(status) ? 'admission pending' : status.state }}<span v-if="status.failureCode && !busy"> · {{ status.failureCode }}</span><span v-if="status.cancelRequested"> · Cancellation acknowledgement is not rollback proof.</span></div>
    <div v-if="!hasResult" class="start"><h2>{{ kind === 'quiz' ? 'Know what you’re reviewing.' : 'See the change, not just the files.' }}</h2><p>{{ kind === 'quiz' ? 'A few questions about the changes. Clear explanations, grounded in the source.' : 'Bring related changes together into a reading order, across files and tests.' }}</p><img :src="kind === 'quiz' ? quizMascot : semanticMascot" alt="" /><progress v-if="busy" :aria-label="`Generating ${name}`" /><AppButton v-else variant="primary" :disabled="!canGenerate" @click="generate">Generate {{ name }}</AppButton><p v-if="!sourceAvailable">Load pinned source before generating. Saved results can still be reopened.</p><AppButton v-if="!sourceAvailable" variant="quiet" @click="$emit('source')">Open Files changed</AppButton></div>
    <slot v-if="hasResult" />
    <ConfirmationDialog :open="confirming" :title="`Regenerate ${name}?`" description="Replace the current complete saved result with a new generation? The previous result stays readable if generation fails or is cancelled before saving." :confirm-label="`Regenerate ${name}`" @cancel="confirming = false" @confirm="replace" />
  </section>
</template>

<style scoped>
.generation-panel { flex: 1; min-height: 0; display: flex; flex-direction: column; overflow: auto; }
header { padding: 16px 24px; display: flex; align-items: center; justify-content: flex-end; gap: 16px; flex-wrap: wrap; }
header h2 { margin: 0 auto 0 0; font-size: 22px; font-weight: 600; }
header > div { display: flex; gap: 8px; flex-wrap: wrap; }
.ready > header { padding: 6px 16px; min-height: 40px; }
.ready > header h2 { font-size: 16px; }
.start { text-align: center; max-width: 540px; margin: auto; padding: 24px 24px clamp(48px, 20dvh, 200px); display: flex; flex-direction: column; align-items: center; gap: 16px; }
.start h2 { font-size: 28px; font-weight: 600; margin: 0; letter-spacing: -.6px; }
.start p { color: var(--muted); margin: 0; }
.start img { width: 144px; height: 144px; object-fit: contain; margin: 12px 0; }
.start progress { width: 160px; accent-color: var(--accent); }
.generation-status { color: var(--muted); font-size: 11px; padding: 0 24px 12px; }
.ready > .generation-status { padding: 0 16px 6px; font-size: 10px; }
.message { margin: 0 16px 12px; }
</style>
