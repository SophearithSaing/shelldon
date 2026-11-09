<script setup lang="ts">
import type { DiffHunk } from '../../api/contracts/source'
defineProps<{ hunk: DiffHunk }>()
</script>

<template>
  <div class="hunk">
    <div class="hunk-heading">@@ -{{ hunk.old.start }},{{ hunk.old.count }} +{{ hunk.new.start }},{{ hunk.new.count }} @@ {{ hunk.section }}</div>
    <div v-for="line in hunk.lines" :key="line.id" :class="['line', { added: line.sign === '+', removed: line.sign === '-' }]">
      <span class="number" aria-hidden="true">{{ line.oldLine }}</span><span class="number" aria-hidden="true">{{ line.newLine }}</span><span class="sign" aria-hidden="true">{{ line.sign }}</span><code>{{ line.text }}<span v-if="line.noNewline" class="no-newline"> ⏎ No newline at end of file</span></code>
    </div>
  </div>
</template>

<style scoped>
.hunk { min-width: max-content; padding-bottom: 12px; background: var(--paper); }
.hunk-heading { background: var(--surface); color: var(--muted); font: 10px/32px var(--mono); padding: 0 18px; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); }
.line { display: flex; min-height: 27px; font: 11px/27px var(--mono); }
.number { display: block; flex: 0 0 38px; text-align: right; padding-right: 10px; color: var(--muted); user-select: none; }
.sign { flex: 0 0 22px; color: var(--muted); text-align: center; user-select: none; }
code { display: block; white-space: pre; padding-right: 24px; font: inherit; }
.added { background: var(--added-bg); }
.removed { background: var(--removed-bg); }
.added .sign { color: var(--added); }
.removed .sign { color: var(--removed); }
.no-newline { color: var(--muted); font-style: italic; }
</style>
