<script setup lang="ts">
import light from '../assets/shelldon-logo-light.png'
import dark from '../assets/shelldon-logo-dark.png'
</script>

<template>
  <span class="brand-logo"><img class="brand-image light-logo" :src="light" alt="Sheldon" /><img class="brand-image dark-logo" :src="dark" alt="Sheldon" /></span>
</template>

<style scoped>
.light-logo { display: none; }
:global([data-theme='light']) .light-logo { display: block; }
:global([data-theme='light']) .dark-logo { display: none; }
</style>
