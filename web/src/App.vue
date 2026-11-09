<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import ApplicationLayout from './layouts/ApplicationLayout.vue'
import GlobalBar from './components/workspace/GlobalBar.vue'
import ConnectionSettings from './components/workspace/ConnectionSettings.vue'
import StatusMessage from './components/ui/StatusMessage.vue'
import EntryPage from './pages/EntryPage.vue'
import ReviewPage from './pages/ReviewPage.vue'
import { connection, initializeConnection } from './composables/connection'
import { currentPath, navigate } from './composables/navigation'

const theme = ref<'dark' | 'light'>('dark')
const connectionOpen = ref(false)
const reviewID = computed((): string | undefined => /^\/reviews\/([a-f0-9]{64})$/.exec(currentPath.value)?.[1])
watch(theme, (value): void => { document.documentElement.dataset.theme = value }, { immediate: true })
onMounted(initializeConnection)
</script>

<template>
  <ApplicationLayout>
    <template #header><GlobalBar :theme="theme" :connected="connection.connected.value" @home="navigate('/')" @theme="theme = theme === 'dark' ? 'light' : 'dark'" @connection="connectionOpen = !connectionOpen" /></template>
    <template #connection><ConnectionSettings v-if="connectionOpen || (!connection.connected.value && !connection.checking.value)" @close="connectionOpen = false" /></template>
    <StatusMessage v-if="connection.checking.value" title="Connecting">Verifying the local connection…</StatusMessage>
    <template v-else-if="connection.connected.value"><ReviewPage v-if="reviewID" :key="reviewID" :id="reviewID" /><EntryPage v-else-if="currentPath === '/'" /><StatusMessage v-else title="Page not found">Open a pull request from the home page.</StatusMessage></template>
  </ApplicationLayout>
</template>
