<script setup lang="ts">
import type { SourceRequest, SourceResponse } from '../../api/contracts/source'
import AppButton from '../ui/AppButton.vue'

defineProps<{ pending: boolean; blocked?: boolean; decision: Exclude<SourceResponse, { state: 'ready' }> | null }>()
defineEmits<{ load: [input: SourceRequest] }>()
</script>

<template>
  <section class="source-loader" aria-label="Load source" :aria-busy="pending">
    <template v-if="decision?.state === 'fallback-required'"><h2>Choose how to load source</h2><p>GitHub metadata is unavailable. Choose a fetched upstream branch explicitly; no target will be assumed.</p><AppButton :disabled="pending || blocked" @click="$emit('load', { action: 'git-only' })">Use Git-only fallback</AppButton></template>
    <template v-else-if="decision?.state === 'base-selection-required'"><h2>Select the target branch</h2><p>Compare the PR against one of these fetched branches.</p><div class="branches"><AppButton v-for="candidate in decision.candidates" :key="candidate.branch" :disabled="pending || blocked" @click="$emit('load', { action: 'select-base', branch: candidate.branch, sha: candidate.sha })">Load {{ candidate.branch }}</AppButton></div></template>
    <template v-else><span class="eyebrow">FILES CHANGED</span><h2>Start with the source.</h2><p>Load a pinned comparison to read the changes, file by file.</p><AppButton variant="primary" :disabled="pending || blocked" @click="$emit('load', { action: 'load' })">{{ pending ? 'Loading pinned source…' : 'Load pinned source' }}</AppButton></template>
    <div v-if="pending" class="skeleton" role="status" aria-label="Loading source"><span /><span /><span /></div>
  </section>
</template>

<style scoped>
.source-loader { margin: 72px auto; padding: 24px; max-width: 520px; text-align: center; }
.eyebrow { color: var(--muted); letter-spacing: 2px; font-size: 10px; }
h2 { font-size: 26px; font-weight: 600; margin: 12px 0; }
p { color: var(--muted); margin: 0 0 24px; }
.branches { display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; }
.skeleton { margin-top: 28px; display: grid; gap: 12px; }
.skeleton span { height: 10px; background: var(--surface); border-radius: 4px; }
.skeleton span:nth-child(2) { width: 80%; }
.skeleton span:nth-child(3) { width: 90%; }
</style>
