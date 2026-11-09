<script setup lang="ts">
import { computed } from 'vue'
import type { QuizChecked, QuizQuestion } from '../../api/contracts/generation'
import AppButton from '../ui/AppButton.vue'
const props = defineProps<{ questions: QuizQuestion[]; checks: Record<string, QuizChecked> }>()
defineEmits<{ retry: []; back: [] }>()
const checked = computed((): QuizChecked[] => Object.values(props.checks))
const correct = computed((): number => checked.value.filter((answer): boolean => answer.correct).length)
</script>

<template><section class="results" aria-label="Quiz practice results"><span class="eyebrow">YOUR PRACTICE</span><h3>{{ correct }} of {{ checked.length }} checked answers correct</h3><p>{{ checked.length }} of {{ questions.length }} questions checked. This practice does not approve the PR or certify understanding.</p><ol><li v-for="question in questions" :key="question.questionID"><span>{{ question.prompt }}</span><strong>{{ checks[question.questionID] ? checks[question.questionID]!.correct ? 'Correct' : 'Incorrect' : 'Not checked' }}</strong></li></ol><footer><AppButton @click="$emit('back')">Back to questions</AppButton><AppButton variant="primary" @click="$emit('retry')">Try again</AppButton></footer><p class="note">Try again resets only this page's practice choices. It does not regenerate the saved quiz.</p></section></template>

<style scoped>
.results { padding: 28px; border: 1px solid var(--border); border-radius: 10px; background: var(--paper); }
.eyebrow { color: var(--muted); font-size: 10px; letter-spacing: 1.5px; }
h3 { font-size: 24px; font-weight: 600; margin: 14px 0; }
p { color: var(--muted); }
ol { padding-left: 20px; }
li { padding: 12px 0; border-bottom: 1px solid var(--border); }
li strong { display: block; color: var(--muted); font-size: 10px; margin-top: 6px; }
footer { display: flex; gap: 12px; margin-top: 24px; flex-wrap: wrap; }
.note { font-size: 11px; }
</style>
