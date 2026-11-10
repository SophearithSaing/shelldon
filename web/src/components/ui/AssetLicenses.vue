<script setup lang="ts">
import syntax from '../../assets/licenses/syntax-highlighting.txt?url&no-inline'
import icons from '../../assets/material/LICENSE.txt?url&no-inline'
import sans from '../../assets/fonts/DM-Sans-LICENSE.txt?url&no-inline'
import mono from '../../assets/fonts/OFL.txt?url&no-inline'
</script>

<template><details class="licenses"><summary>Asset licenses</summary><a :href="icons" target="_blank" rel="noreferrer">Material Symbols · Apache 2.0</a><a :href="sans" target="_blank" rel="noreferrer">DM Sans · SIL Open Font License</a><a :href="mono" target="_blank" rel="noreferrer">JetBrains Mono · SIL Open Font License</a><a :href="syntax" target="_blank" rel="noreferrer">Syntax highlighting · MIT</a></details></template>

<style scoped>
.licenses { width: min(100% - 40px, 1180px); margin: 0 auto 24px; font-size: 11px; color: var(--muted); }
summary { width: fit-content; padding: 4px 0; }
a { display: block; width: fit-content; margin-top: 6px; }
</style>
