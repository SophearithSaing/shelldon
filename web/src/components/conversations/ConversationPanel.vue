<script setup lang="ts">
import { computed, ref } from 'vue'
import { useConversationContext } from '../../composables/useConversations'
import type { ConversationThread } from '../../composables/useConversations'
import ConversationView from './ConversationView.vue'
import { useReadingPosition } from '../../composables/useReadingPosition'
import AppIcon from '../ui/AppIcon.vue'

const q = useConversationContext()
const props = defineProps<{ visible: boolean }>()
const current = computed((): ConversationThread | undefined => q.threads.value.find((thread): boolean => thread.id === q.selected.value))
const root = ref<HTMLElement | null>(null)
useReadingPosition(computed((): HTMLElement | null => root.value?.closest('aside') ?? null), computed((): boolean => props.visible && !q.panelCollapsed.value), q.selected)
</script>

<template>
  <div ref="root" class="panel"><label v-if="q.threads.value.length">Conversation<span class="select-control"><select v-model="q.selected.value" aria-label="Choose conversation">
    <!-- Dynamic native tags work around Vue's outdated select nesting validation. -->
    <component :is="'button'" type="button" class="select-value"><component :is="'selectedcontent'" /></component>
    <option v-for="thread in q.threads.value" :key="thread.id" :value="thread.id">{{ thread.answers[0]?.question.slice(0, 100) }}</option>
  </select><AppIcon class="select-arrow" name="chevron" /></span></label><ConversationView v-if="current" :key="current.id" :thread="current" /><template v-else><p>No conversations yet.</p><p>Select changed lines to ask a question.</p></template></div>
</template>

<style scoped>
.panel { min-width: 0; }
label { display: block; color: var(--muted); font-size: 10px; margin: 0 16px 12px; }
.select-control { display: block; position: relative; margin-top: 5px; }
select { appearance: none; display: block; width: 100%; min-width: 0; overflow: hidden; border: 1px solid var(--border-strong); border-radius: 6px; padding: 8px 40px 8px 8px; background: var(--paper); color: var(--ink); font-size: 11px; white-space: nowrap; text-overflow: ellipsis; }
.select-arrow { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); pointer-events: none; color: var(--ink); }
p { color: var(--muted); font-size: 12px; padding: 0 12px; }
@supports (appearance: base-select) and selector(select::picker(select)) {
  select, select::picker(select) { appearance: base-select; }
  .select-value { display: block; width: 100%; min-width: 0; overflow: hidden; border: 0; padding: 0; background: transparent; color: inherit; font: inherit; text-align: start; white-space: nowrap; }
  selectedcontent { display: block; overflow: hidden; white-space: nowrap; text-overflow: ellipsis; }
  select:open { border-color: var(--accent); }
  select::picker-icon { display: none; }
  select:open + .select-arrow { transform: translateY(-50%) rotate(180deg); color: var(--accent); }
  select::picker(select) { box-sizing: border-box; width: anchor-size(width); max-width: calc(100vw - 32px); max-height: min(320px, 50dvh); overflow: auto; margin-block: 6px; padding: 4px; border: 1px solid var(--border-strong); border-radius: 8px; background: var(--paper); color: var(--ink); box-shadow: 0 8px 24px #0003; font: 11px/1.5 var(--sans); }
  option { min-height: 36px; padding: 8px 10px; border-radius: 4px; gap: 8px; white-space: normal; overflow-wrap: anywhere; cursor: pointer; }
  option:checked { background: var(--accent-soft); color: var(--accent); }
  option:hover, option:focus-visible { background: var(--selected); }
  option:focus-visible { outline: 2px solid var(--accent); outline-offset: -2px; }
  option::checkmark { color: var(--accent); }
  @media (pointer: coarse) { option { min-height: 44px; } }
  @media (forced-colors: active) { select, select::picker(select) { appearance: auto; } }
}
@media (forced-colors: active) { select { appearance: auto; padding-right: 8px; } .select-arrow { display: none; } }
</style>
