<script setup lang="ts">
withDefaults(defineProps<{ tone?: 'error' | 'info'; title?: string }>(), { tone: 'info', title: '' })
</script>

<template>
  <div :class="['message', tone]" :role="tone === 'error' ? 'alert' : 'status'">
    <strong v-if="title">{{ title }}</strong>
    <div><slot /></div>
  </div>
</template>

<style scoped>
.message { padding: 12px 16px; border: 1px solid var(--border); border-radius: 8px; background: var(--surface); color: var(--muted); overflow-wrap: anywhere; }
.message strong { display: block; color: var(--ink); margin-bottom: 4px; }
.error { border-color: var(--removed); color: var(--removed); background: var(--removed-bg); }
</style>
