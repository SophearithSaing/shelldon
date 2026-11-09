<script setup lang="ts">
import type { PullRequest, SourceDiff } from '../../api/contracts/source'
import AppButton from '../ui/AppButton.vue'

defineProps<{ pr: PullRequest; source: SourceDiff | null; pending: boolean }>()
defineEmits<{ refresh: [] }>()
</script>

<template>
  <section class="review-header" aria-label="Pull request context">
    <span class="repository">{{ pr.owner }} / {{ pr.repository }} /</span>
    <h1 :title="pr.title ?? `Pull request #${pr.number}`">{{ pr.title ?? 'Pull request' }} <span>#{{ pr.number }}</span></h1>
    <AppButton v-if="source" :disabled="pending" @click="$emit('refresh')">{{ pending ? 'Refreshing…' : 'Refresh source' }}</AppButton>
    <details class="details"><summary>Details</summary><div class="metadata"><a :href="pr.url" target="_blank" rel="noreferrer">Open on GitHub</a><span v-if="pr.author">Author: {{ pr.author }}</span><template v-if="source"><span>Base: {{ source.revision.baseBranch }}</span><code>{{ source.revision.mergeBaseSHA.slice(0, 8) }} → {{ source.revision.headSHA.slice(0, 8) }}</code></template></div></details>
  </section>
</template>

<style scoped>
.review-header { min-height: 40px; flex-shrink: 0; display: flex; align-items: center; gap: 12px; padding: 4px 16px; background: var(--paper); position: relative; }
.repository { color: var(--muted); font-size: 12px; white-space: nowrap; }
h1 { font-size: 16px; font-weight: 650; margin: 0; min-width: 0; flex: 1; text-overflow: ellipsis; white-space: nowrap; overflow: hidden; }
h1 span { color: var(--muted); }
summary { font-size: 11px; color: var(--muted); padding: 4px; }
.metadata { z-index: 10; position: absolute; right: 16px; top: 100%; display: flex; flex-direction: column; gap: 10px; padding: 16px; border: 1px solid var(--border-strong); border-radius: 8px; background: var(--paper); box-shadow: 0 8px 24px #0003; max-width: calc(100vw - 32px); overflow-wrap: anywhere; }
@media (max-width: 760px) { .review-header { flex-wrap: wrap; } h1 { flex-basis: 65%; white-space: normal; } .repository { flex-basis: 100%; } summary { min-height: 44px; display: flex; align-items: center; } }
</style>
