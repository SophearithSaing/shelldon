<script setup lang="ts">
import { nextTick, ref } from 'vue'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'

defineProps<{ collapsed: boolean }>()
const emit = defineEmits<{ collapse: [] }>()
const toggle = ref<InstanceType<typeof AppButton> | null>(null)

/** Toggles the panel while preserving keyboard focus. */
async function collapse(): Promise<void> {
  emit('collapse')
  await nextTick()
  ;(toggle.value?.$el as HTMLButtonElement | undefined)?.focus()
}
</script>

<template>
  <div class="conversations" :class="{ collapsed }"><header><strong v-if="!collapsed">Conversations</strong><AppButton ref="toggle" variant="quiet" :aria-label="collapsed ? 'Open conversations panel' : 'Collapse conversations panel'" :aria-expanded="!collapsed" @click="collapse"><AppIcon name="chevron" :class="collapsed ? 'left' : 'right'" /></AppButton></header><span v-if="collapsed" class="rail-title">Conversations</span><div v-else class="content"><slot><p>No conversations yet.</p></slot></div></div>
</template>

<style scoped>
.conversations { min-height: 100%; }
header { display: flex; align-items: center; justify-content: space-between; padding: 12px; gap: 8px; }
strong { font-size: 12px; }
.content { border-top: 1px solid var(--border); padding: 20px; color: var(--muted); }
.content p { font-size: 12px; }
.collapsed header { padding: 12px 0; justify-content: center; }
.rail-title { display: block; writing-mode: vertical-rl; color: var(--muted); margin: 8px auto; font-size: 11px; }
.right { transform: rotate(-90deg); }
.left { transform: rotate(90deg); }
@media (max-width: 760px) { .collapsed { display: flex; align-items: center; gap: 12px; padding: 0 12px; } .rail-title { writing-mode: horizontal-tb; margin: 0; } }
</style>
