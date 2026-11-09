<script setup lang="ts">
import { computed, onBeforeUnmount, ref, toRef, watch } from 'vue'
import type { SourceDiff } from '../../api/contracts/source'
import type { Quiz, QuizChecked, QuizRead } from '../../api/contracts/generation'
import { checkQuiz } from '../../api/generation'
import { errorMessage } from '../../api/client'
import { useGeneration } from '../../composables/useGeneration'
import GenerationPanel from '../workspace/GenerationPanel.vue'
import QuizQuestionCard from './QuizQuestionCard.vue'
import QuizProgress from './QuizProgress.vue'
import QuizResults from './QuizResults.vue'
import AppButton from '../ui/AppButton.vue'
import StatusMessage from '../ui/StatusMessage.vue'

const props = defineProps<{ prId: string; source: SourceDiff | null; sourcePending: boolean; active: boolean }>()
defineEmits<{ source: [] }>()
const generation = useGeneration<QuizRead>(props.prId, 'quiz', toRef(props, 'source'), toRef(props, 'sourcePending'), toRef(props, 'active'))
const quiz = computed((): Quiz | null => generation.result.value?.quiz ?? null)
const count = computed((): number | undefined => quiz.value?.questions.length)
const index = ref(0)
const choices = ref<Record<string, string>>({})
const checks = ref<Record<string, QuizChecked>>({})
const checking = ref(false)
const error = ref('')
const results = ref(false)
const lifetime = new AbortController()

/** Clears only page-memory practice, leaving saved content and generation untouched. */
function retry(): void { choices.value = {}; checks.value = {}; index.value = 0; results.value = false; error.value = '' }

/** Checks the captured saved question without exposing any other key. */
async function check(): Promise<void> {
  const original = quiz.value
  const question = original?.questions[index.value]
  const choiceID = question ? choices.value[question.questionID] : undefined
  if (!original || !question || !choiceID || checking.value || checks.value[question.questionID]) return
  checking.value = true
  error.value = ''
  try {
    const answer = await checkQuiz(props.prId, original, question.questionID, choiceID, lifetime.signal)
    if (lifetime.signal.aborted || quiz.value?.quizID !== original.quizID) return
    if (answer.prID !== props.prId || answer.quizID !== original.quizID || answer.revisionID !== original.revisionID || answer.questionID !== question.questionID || answer.choiceID !== choiceID || answer.version !== generation.result.value?.version || answer.correct !== (answer.choiceID === answer.correctChoiceID)) throw new Error('Mismatched checked question.')
    checks.value[question.questionID] = answer
  } catch (cause) { if (!lifetime.signal.aborted) error.value = errorMessage(cause) }
  finally { checking.value = false }
}

watch((): string | undefined => quiz.value?.quizID, retry)
onBeforeUnmount((): void => lifetime.abort())
defineExpose({ count })
</script>

<template>
  <GenerationPanel kind="quiz" :has-result="!!quiz" :source-available="!!source" :older="!!source && !!quiz && source.revisionID !== quiz.revisionID" :busy="generation.busy.value" :pending="generation.pending.value" :blocked="generation.blocked.value" :can-generate="generation.canGenerate.value" :status="generation.status.value" :error="generation.error.value" @generate="generation.start" @cancel="generation.cancel" @refresh="generation.read" @source="$emit('source')">
    <div v-if="quiz" class="quiz-practice"><p class="practice-label">Practice · {{ quiz.questions.length }} questions · choices are not saved</p><StatusMessage v-if="error" tone="error">{{ error }}</StatusMessage><QuizResults v-if="results" :questions="quiz.questions" :checks="checks" @retry="retry" @back="results = false" /><template v-else><QuizProgress :total="quiz.questions.length" :current="index" :checked="Object.keys(checks)" @select="index = $event" /><QuizQuestionCard v-if="quiz.questions[index]" :question="quiz.questions[index]!" :index="index" :total="quiz.questions.length" :choice="choices[quiz.questions[index]!.questionID] ?? ''" :checked="checks[quiz.questions[index]!.questionID]" :checking="checking" @choice="choices[quiz!.questions[index]!.questionID] = $event" @check="check" /><footer><AppButton :disabled="index === 0" @click="index--">Previous question</AppButton><AppButton v-if="index < quiz.questions.length - 1" @click="index++">Next question</AppButton><AppButton v-else variant="primary" @click="results = true">See results</AppButton></footer></template></div>
  </GenerationPanel>
</template>

<style scoped>
.quiz-practice { width: min(100% - 40px, 740px); margin: 12px auto 48px; }
.practice-label { color: var(--muted); font-size: 11px; margin-bottom: 20px; }
footer { display: flex; justify-content: space-between; gap: 16px; margin-top: 20px; }
.message { margin-bottom: 16px; }
</style>
