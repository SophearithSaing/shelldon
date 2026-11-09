<script setup lang="ts">
import { ref, toRef } from 'vue'
import ReviewHeader from '../components/workspace/ReviewHeader.vue'
import FeatureNavigation from '../components/workspace/FeatureNavigation.vue'
import type { Feature } from '../components/workspace/FeatureNavigation.vue'
import ReviewLayout from '../layouts/ReviewLayout.vue'
import FileTree from '../components/source/FileTree.vue'
import PinnedDiff from '../components/source/PinnedDiff.vue'
import SourceLoader from '../components/source/SourceLoader.vue'
import ConversationsRail from '../components/conversations/ConversationsRail.vue'
import ComingSoon from '../components/reviews/ComingSoon.vue'
import StatusMessage from '../components/ui/StatusMessage.vue'
import AppButton from '../components/ui/AppButton.vue'
import { useReview } from '../composables/useReview'

const props = defineProps<{ id: string }>()
const { pr, source, decision, pending, metadataPending, error, understood, activeFile, progress, read, load, refresh, toggleUnderstood } = useReview(toRef(props, 'id'))
const feature = ref<Feature>('files')
const filesCollapsed = ref(false)
const conversationsCollapsed = ref(true)
const diff = ref<InstanceType<typeof PinnedDiff> | null>(null)
</script>

<template>
  <StatusMessage v-if="metadataPending" title="Opening pull request">Reading registered PR details…</StatusMessage>
  <StatusMessage v-if="error" tone="error">{{ error }} <AppButton v-if="!pr" @click="read">Retry opening PR</AppButton></StatusMessage>
  <template v-if="pr">
    <ReviewHeader :pr="pr" :source="source" :pending="pending" @refresh="refresh" />
    <FeatureNavigation :selected="feature" :file-count="source?.files.length" @select="feature = $event" />
    <ReviewLayout v-show="feature === 'files'" :files-collapsed="filesCollapsed" :conversations-collapsed="conversationsCollapsed">
      <template #files><FileTree :files="source?.files ?? []" :active="activeFile" :understood="understood" :percentage="progress" :collapsed="filesCollapsed" @collapse="filesCollapsed = !filesCollapsed" @select="diff?.jump($event)" /></template>
      <SourceLoader v-if="!source || decision" :pending="pending" :decision="decision" @load="load" />
      <PinnedDiff v-if="source" ref="diff" :source="source" :understood="understood" @active="activeFile = $event" @understood="toggleUnderstood" />
      <template #conversations><ConversationsRail :collapsed="conversationsCollapsed" @collapse="conversationsCollapsed = !conversationsCollapsed" /></template>
    </ReviewLayout>
    <ComingSoon v-if="feature === 'overview'" title="Pull request overview" description="Description, author details, branches and commits in one place." />
    <ComingSoon v-if="feature === 'questions'" title="Saved questions" description="Reopen your source-anchored conversations and continue where you left off." />
    <ComingSoon v-if="feature === 'quiz'" title="Test your understanding" description="Practice with questions grounded in this pull request's changes." />
    <ComingSoon v-if="feature === 'semantic'" title="Review by intent" description="Explore related changes across files, organized into semantic groups." />
  </template>
</template>
