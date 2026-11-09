<script setup lang="ts">
withDefaults(defineProps<{ variant?: 'primary' | 'quiet' | 'outline'; type?: 'button' | 'submit'; disabled?: boolean }>(), { variant: 'outline', type: 'button', disabled: false })
</script>

<template>
  <button :type="type" :disabled="disabled" :class="['button', variant]"><slot /></button>
</template>

<style scoped>
.button { display: inline-flex; align-items: center; justify-content: center; gap: 7px; min-height: 28px; border: 1px solid var(--border-strong); border-radius: 6px; background: transparent; color: var(--ink); padding: 4px 10px; font-size: 12px; font-weight: 600; white-space: nowrap; }
.button:hover:not(:disabled) { background: var(--surface); }
.primary { background: var(--accent); border-color: var(--accent); color: var(--on-accent); }
.primary:hover:not(:disabled) { background: var(--accent-hover); }
.quiet { border-color: transparent; color: var(--muted); }
.button:disabled { opacity: .5; }
@media (max-width: 760px), (pointer: coarse) { .button { min-height: 44px; } }
</style>
