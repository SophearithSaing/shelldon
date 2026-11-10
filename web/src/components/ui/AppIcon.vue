<script setup lang="ts">
import dark from '../../assets/material/dark_mode.svg?url'
import light from '../../assets/material/light_mode.svg?url'
import person from '../../assets/material/person.svg?url'
import agent from '../../assets/material/smart_toy.svg?url'
import chevron from '../../assets/material/expand_more.svg?url'
import checked from '../../assets/material/check_circle.svg?url'
import circle from '../../assets/material/circle.svg?url'
import merge from '../../assets/material/merge.svg?url'
import refresh from '../../assets/material/refresh.svg?url'

defineProps<{ name: 'dark' | 'light' | 'person' | 'agent' | 'chevron' | 'checked' | 'circle' | 'merge' | 'refresh' }>()
const icons = { dark, light, person, agent, chevron, checked, circle, merge, refresh }
</script>

<template><span class="icon" aria-hidden="true" :style="{ maskImage: 'url(' + JSON.stringify(icons[name]) + ')' }" /></template>

<style scoped>
.icon { display: inline-block; width: 18px; height: 18px; flex: 0 0 18px; background: currentColor; mask-size: contain; mask-position: center; mask-repeat: no-repeat; }
</style>
