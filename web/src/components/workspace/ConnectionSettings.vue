<script setup lang="ts">
import { ref } from 'vue'
import { connect, connection, disconnect } from '../../composables/connection'
import AppButton from '../ui/AppButton.vue'
import StatusMessage from '../ui/StatusMessage.vue'

defineEmits<{ close: [] }>()
const token = ref('')

/** Verifies the provided token and clears the input after use. */
async function submit(): Promise<void> {
  await connect(token.value)
  token.value = ''
}
</script>

<template>
  <section class="connection" aria-label="Backend connection">
    <div class="heading"><h2>Local connection</h2><AppButton variant="quiet" @click="$emit('close')">Close</AppButton></div>
    <p>Connect to the Sheldon backend running on your computer.</p>
    <StatusMessage v-if="connection.error.value" tone="error">{{ connection.error.value }}</StatusMessage>
    <template v-if="connection.connected.value">
      <p>Connected. Disconnecting clears this page's source and drafts, not accepted backend work.</p>
      <AppButton @click="disconnect">Disconnect backend</AppButton>
    </template>
    <form v-else @submit.prevent="submit">
      <label v-if="connection.requiresCredential" for="api-token">API token</label>
      <input v-if="connection.requiresCredential" id="api-token" v-model="token" type="password" required autocomplete="off" spellcheck="false" />
      <AppButton type="submit" variant="primary" :disabled="connection.checking.value">{{ connection.checking.value ? 'Verifying…' : 'Connect backend' }}</AppButton>
    </form>
  </section>
</template>

<style scoped>
.connection { border-bottom: 1px solid var(--border); background: var(--paper); padding: 20px; }
.heading { display: flex; align-items: center; justify-content: space-between; }
h2 { margin: 0; font-size: 16px; }
p { color: var(--muted); }
form { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 12px; }
input { min-width: 160px; width: min(100%, 360px); padding: 8px; background: var(--canvas); color: var(--ink); border: 1px solid var(--border-strong); border-radius: 6px; }
</style>
