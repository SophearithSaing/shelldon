<script setup lang="ts">
import darkLogo from '../../assets/shelldon-logo-dark.png'
import lightLogo from '../../assets/shelldon-logo-light.png'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'

defineProps<{ theme: 'dark' | 'light'; connected: boolean }>()
defineEmits<{ home: []; theme: []; connection: [] }>()
</script>

<template>
  <header class="global-bar">
    <a class="brand" href="/" aria-label="Sheldon home" @click.prevent="$emit('home')"><img :src="theme === 'dark' ? darkLogo : lightLogo" alt="Sheldon" /></a>
    <button class="home" @click="$emit('home')">Pull requests</button>
    <div class="workspace"><slot /></div>
    <AppButton variant="quiet" @click="$emit('connection')"><span :class="['dot', { connected }]" />{{ connected ? 'Connected' : 'Connect' }}</AppButton>
    <AppButton variant="quiet" :aria-label="`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`" @click="$emit('theme')"><AppIcon :name="theme === 'dark' ? 'light' : 'dark'" /></AppButton>
  </header>
</template>

<style scoped>
.global-bar { min-height: 40px; flex-shrink: 0; display: flex; align-items: center; gap: 12px; padding: 0 16px; border-bottom: 1px solid var(--border); background: var(--paper); }
.brand { display: flex; flex-shrink: 0; }
.brand img { width: 108px; height: 34px; object-fit: contain; }
.home { border: 0; background: transparent; color: var(--muted); padding: 4px 12px; }
.workspace { min-width: 0; flex: 1; }
.dot { width: 6px; height: 6px; border: 1px solid var(--muted); border-radius: 50%; }
.dot.connected { border-color: var(--accent); background: var(--accent); }
@media (max-width: 760px) { .global-bar { gap: 4px; padding: 4px 8px; flex-wrap: wrap; } .home { min-height: 44px; } .workspace { display: none; } }
</style>
