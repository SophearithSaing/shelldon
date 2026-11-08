<script setup lang="ts">
import light from '../assets/material/light_mode.svg'
import dark from '../assets/material/dark_mode.svg'
import person from '../assets/material/person.svg'
import agent from '../assets/material/smart_toy.svg'

defineProps<{ name: 'light' | 'dark' | 'person' | 'agent' }>()
const icons = { light, dark, person, agent }
</script>

<template>
  <span class="material-icon" aria-hidden="true" :style="{ maskImage: `url(&quot;${icons[name]}&quot;)` }" />
</template>

<style scoped>
.material-icon { display: inline-block; flex-shrink: 0; width: 1.125rem; height: 1.125rem; background: currentColor; mask-size: contain; mask-repeat: no-repeat; mask-position: center; }
</style>
