<script setup lang="ts">
defineProps<{ filesCollapsed: boolean; conversationsCollapsed: boolean }>()
</script>

<template>
  <div class="review-layout" :class="{ 'files-collapsed': filesCollapsed, 'conversations-collapsed': conversationsCollapsed }"><aside class="files"><slot name="files" /></aside><section class="source"><slot /></section><aside class="conversations"><slot name="conversations" /></aside></div>
</template>

<style scoped>
.review-layout { display: grid; grid-template-columns: 190px minmax(0, 1fr) 350px; flex: 1; min-height: 0; }
.files-collapsed { grid-template-columns: 40px minmax(0, 1fr) 350px; }
.conversations-collapsed { grid-template-columns: 190px minmax(0, 1fr) 40px; }
.files-collapsed.conversations-collapsed { grid-template-columns: 40px minmax(0, 1fr) 40px; }
.files, .source, .conversations { min-width: 0; min-height: 0; }
.files { border-right: 1px solid var(--border); overflow: auto; }
.source { overflow: hidden; display: flex; flex-direction: column; }
.conversations { border-left: 1px solid var(--border); overflow: auto; }
@media (max-width: 900px) { .review-layout { grid-template-columns: 160px minmax(0, 1fr) 280px; } .files-collapsed { grid-template-columns: 40px minmax(0, 1fr) 280px; } .conversations-collapsed { grid-template-columns: 160px minmax(0, 1fr) 40px; } .files-collapsed.conversations-collapsed { grid-template-columns: 40px minmax(0, 1fr) 40px; } }
@media (max-width: 760px) { .review-layout, .files-collapsed, .conversations-collapsed, .files-collapsed.conversations-collapsed { display: flex; flex-direction: column; min-height: auto; } .files { border-right: 0; border-bottom: 1px solid var(--border); max-height: 240px; flex-shrink: 0; } .source { overflow: visible; min-height: 360px; } .conversations { border-left: 0; border-top: 1px solid var(--border); flex-shrink: 0; } }
</style>
