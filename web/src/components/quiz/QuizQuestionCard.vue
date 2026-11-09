<script setup lang="ts">
import { useId } from 'vue'
import type { QuizChecked, QuizQuestion } from '../../api/contracts/generation'
import AppButton from '../ui/AppButton.vue'
import EvidenceQuote from '../source/EvidenceQuote.vue'

defineProps<{ question: QuizQuestion; index: number; total: number; choice: string; checked?: QuizChecked; checking: boolean }>()
defineEmits<{ choice: [choiceID: string]; check: [] }>()
const id = useId()
</script>

<template>
  <article class="question-card" :aria-label="`Quiz question ${index + 1}`"><span class="eyebrow">QUESTION {{ index + 1 }} OF {{ total }}</span><h3>{{ question.prompt }}</h3><fieldset :disabled="!!checked || checking"><legend>Choose one answer</legend><label v-for="option in question.choices" :key="option.choiceID" :class="{ selected: choice === option.choiceID, correct: checked?.correctChoiceID === option.choiceID, incorrect: checked && choice === option.choiceID && !checked.correct }"><input type="radio" :name="id" :value="option.choiceID" :checked="choice === option.choiceID" @change="$emit('choice', option.choiceID)" /><span>{{ option.text }}</span><strong v-if="checked?.correctChoiceID === option.choiceID">Correct answer</strong><strong v-else-if="checked && choice === option.choiceID && !checked.correct">Your answer</strong></label></fieldset><footer v-if="!checked"><span>Choose an alternative, then check your answer.</span><AppButton variant="primary" :disabled="!choice || checking" @click="$emit('check')">{{ checking ? 'Checking…' : 'Check answer' }}</AppButton></footer><section v-else class="explanation" aria-label="Checked explanation"><h4>{{ checked.correct ? 'That’s right.' : 'Not quite.' }}</h4><p>{{ checked.explanation }}</p><EvidenceQuote v-for="(evidence, number) in checked.evidence" :key="number" :evidence="evidence" :revision-id="checked.revisionID" /></section></article>
</template>

<style scoped>
.question-card { padding: 28px; border: 1px solid var(--border); border-radius: 10px; background: var(--paper); }
.eyebrow { color: var(--muted); font-size: 10px; font-weight: 650; letter-spacing: 1.5px; }
h3 { font-size: 17px; line-height: 1.5; margin: 18px 0 20px; }
fieldset { border: 0; padding: 0; margin: 0; min-width: 0; }
legend { font-size: 11px; color: var(--muted); margin-bottom: 10px; }
label { display: flex; align-items: center; gap: 14px; padding: 14px 16px; margin-bottom: 10px; border: 1px solid var(--border-strong); border-radius: 7px; cursor: pointer; font-size: 12px; }
label:focus-within { border-color: var(--accent); box-shadow: 0 0 0 2px var(--focus); }
input { accent-color: var(--accent); margin: 0; flex-shrink: 0; }
input:focus { outline: none; box-shadow: none; }
label > span { flex: 1; }
label strong { font-size: 10px; }
.selected { border-color: var(--accent); background: var(--accent-soft); }
.correct { border-color: var(--added); background: var(--added-bg); }
.incorrect { border-color: var(--removed); background: var(--removed-bg); }
footer { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; margin-top: 18px; }
footer span { color: var(--muted); font-size: 10px; }
.explanation { margin-top: 24px; border-top: 1px solid var(--border); padding-top: 16px; }
h4 { margin: 0; font-size: 15px; }
.explanation p { line-height: 1.8; }
@media (max-width: 760px) { .question-card { padding: 20px 16px; } label { min-height: 44px; flex-wrap: wrap; } }
</style>
