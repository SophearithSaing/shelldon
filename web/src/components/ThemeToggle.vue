<script setup lang="ts">
import { ref } from 'vue'
import UiButton from './ui/UiButton.vue'

const light = ref(document.documentElement.dataset.theme === 'light')

/** Switches only the document palette without replacing workspace state. */
function toggle(): void {
  light.value = !light.value
  document.documentElement.dataset.theme = light.value ? 'light' : 'dark'
}
</script>

<template>
  <UiButton variant="quiet" :aria-label="light ? 'Switch to dark theme' : 'Switch to light theme'" @click="toggle">{{ light ? '☾' : '☀' }}</UiButton>
</template>
