<script setup lang="ts">
defineProps<{ title: string; description: string }>()
</script>

<template><section class="coming-soon"><span class="label">Coming soon</span><h2>{{ title }}</h2><p>{{ description }}</p></section></template>

<style scoped>
.coming-soon { padding: 28px 32px; border: 1px dashed var(--border-strong); border-radius: 9px; width: min(100% - 40px, 660px); margin: 16px auto 32px; }
.label { color: var(--muted); font-size: 11px; padding: 3px 8px; background: var(--surface); border-radius: 99px; }
h2 { font-size: 18px; margin: 12px 0 6px; }
p { color: var(--muted); margin: 0; }
</style>
