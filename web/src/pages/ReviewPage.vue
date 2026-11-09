<script setup lang="ts">
import { nextTick, provide, ref, toRef, watch } from 'vue'
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
import { ConversationsKey, useConversations } from '../composables/useConversations'
import ConversationPanel from '../components/conversations/ConversationPanel.vue'
import DraftNotice from '../components/conversations/DraftNotice.vue'
import SavedQuestions from '../components/questions/SavedQuestions.vue'
import QuizView from '../components/quiz/QuizView.vue'
import SemanticView from '../components/semantic/SemanticView.vue'

const props = defineProps<{ id: string }>()
const { pr, source, decision, pending, metadataPending, error, understood, activeFile, progress, read, load, refresh, toggleUnderstood } = useReview(toRef(props, 'id'))
const feature = ref<Feature>('files')
const filesCollapsed = ref(false)
const diff = ref<InstanceType<typeof PinnedDiff> | null>(null)
const quiz = ref<InstanceType<typeof QuizView> | null>(null)
const semantic = ref<InstanceType<typeof SemanticView> | null>(null)
const q = useConversations(props.id, source, pending)
provide(ConversationsKey, q)

/** Reveals only source navigation accepted by the original-anchor coordinator. */
async function revealSource(): Promise<void> {
  const target = q.sourceRequest.value
  if (!target) return
  feature.value = 'files'
  await nextTick()
  await diff.value?.jump(target.fileID, target.anchor)
  if (target.focusDraft || target.focusThread) diff.value?.focusComposer(target.fileID, target.focusThread)
}

watch(q.sourceRequest, revealSource)
</script>

<template>
  <StatusMessage v-if="metadataPending" title="Opening pull request">Reading registered PR details…</StatusMessage>
  <StatusMessage v-if="error" tone="error">{{ error }} <AppButton v-if="!pr" @click="read">Retry opening PR</AppButton></StatusMessage>
  <template v-if="pr">
    <ReviewHeader :pr="pr" :source="source" :pending="pending" :refresh-blocked="!!q.draft.value" @refresh="refresh" />
    <FeatureNavigation :selected="feature" :file-count="source?.files.length" :quiz-count="quiz?.count" :semantic-count="semantic?.count" @select="feature = $event" />
    <DraftNotice />
    <StatusMessage v-if="q.error.value" tone="error">{{ q.error.value }}</StatusMessage>
    <ReviewLayout v-show="feature === 'files'" :files-collapsed="filesCollapsed" :conversations-collapsed="q.panelCollapsed.value">
      <template #files><FileTree :files="source?.files ?? []" :active="activeFile" :understood="understood" :percentage="progress" :collapsed="filesCollapsed" @collapse="filesCollapsed = !filesCollapsed" @select="diff?.jump($event)" /></template>
      <SourceLoader v-if="!source || decision" :pending="pending" :decision="decision" @load="load" />
      <PinnedDiff v-if="source" ref="diff" :source="source" :understood="understood" @active="activeFile = $event" @understood="toggleUnderstood" />
      <template #conversations><ConversationsRail :collapsed="q.panelCollapsed.value" @collapse="q.panelCollapsed.value = !q.panelCollapsed.value"><ConversationPanel /></ConversationsRail></template>
    </ReviewLayout>
    <ComingSoon v-if="feature === 'overview'" title="Pull request overview" description="Description, author details, branches and commits in one place." />
    <SavedQuestions v-show="feature === 'questions'" :active="feature === 'questions'" />
    <QuizView v-show="feature === 'quiz'" ref="quiz" :pr-id="id" :source="source" :active="feature === 'quiz'" @source="feature = 'files'" />
    <SemanticView v-show="feature === 'semantic'" ref="semantic" :pr-id="id" :source="source" :active="feature === 'semantic'" :files-collapsed="filesCollapsed" :understood="understood" @source="feature = 'files'" @collapse="filesCollapsed = !filesCollapsed" @understood="toggleUnderstood" />
  </template>
</template>
