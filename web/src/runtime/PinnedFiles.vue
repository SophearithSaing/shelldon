<script setup lang="ts">
import { nextTick, ref } from 'vue'
import UiButton from '../components/ui/UiButton.vue'
import SourceQuestions from './SourceQuestions.vue'
import type { DiffLine } from '../components/diff'
import type { PinnedDiff, SourceFile } from './source'
import type { RuntimeClient } from './client'
import type { InitialQuestion, QuestionAnchor, QuestionAnswer } from './questions'
import type { RuntimeThread } from './conversations'

const props = defineProps<{ diff: PinnedDiff; client: RuntimeClient; threads: RuntimeThread[]; pending: boolean; busyReason: string; understood: Record<string, boolean> }>()
const selected = defineModel<string>('selected', { required: true })
const emit = defineEmits<{ guard: [active: boolean]; sending: [pending: boolean]; admitted: [answer: QuestionAnswer, input: InitialQuestion]; open: [answer: QuestionAnswer, trigger: HTMLElement]; understood: [fileID: string] }>()
const root = ref<HTMLElement>()
const questions = new Map<string, InstanceType<typeof SourceQuestions>>()
const draftFile = ref('')
const displayLines = new WeakMap<SourceFile, DiffLine[]>()

/** Adapts literal pinned hunks without generating or fetching source.
 * @param file Original changed file.
 * @returns Display rows including original hunk and final-newline boundaries.
 */
function lines(file: SourceFile): DiffLine[] {
  const previous = displayLines.get(file)
  if (previous) return previous
  const result = file.hunks.flatMap((hunk): DiffLine[] => hunk.lines.map((line, index): DiffLine => ({
    id: line.id, hunkID: hunk.id, base: line.oldLine ?? null, head: line.newLine ?? null,
    kind: line.sign === '+' ? 'added' : line.sign === '-' ? 'removed' : 'context', text: line.text, noNewline: line.noNewline,
    hunkHeader: index === 0 ? `@@ -${hunk.old.start},${hunk.old.count} +${hunk.new.start},${hunk.new.count} @@${hunk.section}` : undefined,
  })))
  displayLines.set(file, result)
  return result
}

/** Projects canonical admissions onto their original source file.
 * @param fileID Original file identity.
 * @returns Existing markers belonging to this revision and file.
 */
function markers(fileID: string): { answer: QuestionAnswer; anchor: QuestionAnchor }[] {
  return props.threads.filter((thread): boolean => thread.turns[0]!.answer.revisionID === props.diff.revisionID && thread.input.anchor.fileID === fileID)
    .map((thread): { answer: QuestionAnswer; anchor: QuestionAnchor } => ({ answer: thread.turns[0]!.answer, anchor: thread.input.anchor }))
}

/** Keeps one initial draft pinned while permitting reading other files.
 * @param fileID Owning file.
 * @param active Whether its draft remains unresolved.
 */
function guard(fileID: string, active: boolean): void {
  if (active) draftFile.value = fileID
  else if (draftFile.value === fileID) draftFile.value = ''
  emit('guard', !!draftFile.value)
}

/** Registers the mounted per-file composer for exact-anchor navigation.
 * @param fileID Original file.
 * @param instance Mounted component or null on removal.
 */
function register(fileID: string, instance: unknown): void {
  if (instance) questions.set(fileID, instance as InstanceType<typeof SourceQuestions>)
  else questions.delete(fileID)
}

/** Finds a file section without interpolating untrusted paths into selectors.
 * @param fileID Revision-scoped identity.
 * @returns Its mounted section if present.
 */
function section(fileID: string): HTMLElement | undefined {
  return Array.from(root.value?.querySelectorAll<HTMLElement>('[data-source-file]') ?? []).find((element): boolean => element.dataset.sourceFile === fileID)
}

/** Jumps within the existing comparison without replacing any file or draft.
 * @param fileID Requested file identity.
 */
async function selectFile(fileID: string): Promise<void> {
  await nextTick()
  const target = section(fileID)
  if (!target) return
  selected.value = fileID
  target.scrollIntoView({ block: 'start' })
  target.querySelector<HTMLElement>('h2')?.focus({ preventScroll: true })
}

/** Selects validated original evidence using the existing one-range contract.
 * @param anchor Original anchor.
 * @param compose Whether to open an initial draft without sending it.
 */
async function selectRange(anchor: QuestionAnchor, compose: boolean): Promise<void> {
  if (draftFile.value || props.pending) return
  await selectFile(anchor.fileID)
  await questions.get(anchor.fileID)?.selectRange(anchor, compose)
}

/** Tracks the file nearest the reading edge without moving focus or loading source. */
function updateCurrent(): void {
  const container = root.value?.parentElement
  if (!container || container.clientHeight === 0) return
  const edge = container.getBoundingClientRect().top + 40
  const sections = Array.from(root.value?.querySelectorAll<HTMLElement>('[data-source-file]') ?? [])
  const visible = sections.find((element): boolean => element.getBoundingClientRect().bottom > edge)
  if (visible?.dataset.sourceFile) selected.value = visible.dataset.sourceFile
}

/** Reveals one canonical inline transcript in its already-loaded original file.
 * @param thread Canonical retained thread.
 */
async function showInline(thread: RuntimeThread): Promise<void> {
  if (draftFile.value || props.pending || thread.turns[0]!.answer.revisionID !== props.diff.revisionID) return
  await selectFile(thread.input.anchor.fileID)
  questions.get(thread.input.anchor.fileID)?.showInline(thread.id)
  await nextTick()
  const target = section(thread.input.anchor.fileID)
  const marker = Array.from(target?.querySelectorAll<HTMLElement>('[data-answer]') ?? []).find((element): boolean => element.dataset.answer === thread.turns[0]!.answer.answerID)
  marker?.scrollIntoView({ block: 'center' })
  marker?.focus({ preventScroll: true })
}
defineExpose({ selectFile, selectRange, updateCurrent, showInline })
</script>

<template>
  <div ref="root" class="pinned-files">
    <article v-for="file in diff.files" :key="file.id" :data-source-file="file.id" class="pinned-file" :aria-label="`Changed file ${file.newPath ?? file.oldPath}`">
      <header class="file-header">
        <h2 tabindex="-1">{{ file.newPath ?? file.oldPath }}</h2>
        <UiButton variant="quiet" :aria-pressed="understood[file.id] === true" :aria-label="`${understood[file.id] ? 'Unmark understood' : 'Mark understood'} ${file.newPath ?? file.oldPath}`" @click="emit('understood', file.id)">{{ understood[file.id] ? '✓ Understood' : '○ Mark understood' }}</UiButton>
        <details v-if="file.oldPath !== file.newPath || file.oldMode !== file.newMode || file.kind !== 'text'"><summary>Change details</summary><p>{{ file.status }} · {{ file.kind }}</p><p v-if="file.oldPath && file.newPath && file.oldPath !== file.newPath">Renamed from {{ file.oldPath }}</p><p v-if="file.oldMode !== file.newMode">Mode {{ file.oldMode }} → {{ file.newMode }}</p></details>
      </header>
      <SourceQuestions v-if="file.kind === 'text'" :ref="(instance): void => register(file.id, instance)" :diff="diff" :file="file" :lines="lines(file)" :client="client" :source-pending="pending" :selection-blocked="!!draftFile && draftFile !== file.id" :markers="markers(file.id)" :busy-reason="busyReason" @guard="(active): void => guard(file.id, active)" @sending="emit('sending', $event)" @admitted="(answer, input): void => emit('admitted', answer, input)" @open="(answer, trigger): void => emit('open', answer, trigger)">
        <template #conversation="slotProps"><slot name="conversation" v-bind="slotProps" /></template>
      </SourceQuestions>
      <div v-else class="source-notice" role="status"><h3>{{ file.kind }} change</h3><p>{{ file.reason ?? 'This change has no unified text lines. No source lines are invented.' }}</p><p>Line questions are unavailable for non-text changes.</p><p v-if="file.kind === 'submodule'">Submodules are not initialized.</p><p>Old object: {{ file.oldObject }}</p><p>New object: {{ file.newObject }}</p></div>
    </article>
    <div v-if="!diff.files.length" class="source-notice"><h2>No changes in this comparison</h2><p>The pinned merge base and head have an empty diff.</p></div>
  </div>
</template>

<style scoped>
.pinned-files { min-width: 0; }
.pinned-file { min-width: 0; border-bottom: 1rem solid var(--color-canvas); scroll-margin-top: 0; }
.file-header { position: sticky; top: 0; z-index: 2; display: flex; flex-wrap: wrap; align-items: center; gap: var(--space-2); padding: 0 var(--space-3); min-height: 2rem; border-block: 1px solid var(--color-border); background: var(--color-surface); }
.file-header h2 { flex: 1; font: var(--text-code-meta)/1.5 var(--font-code); overflow-wrap: anywhere; min-width: 0; }
.file-header details { font-size: var(--text-small); max-width: 100%; overflow-wrap: anywhere; }
.file-header summary { cursor: pointer; }
.file-header .ui-button { padding-block: 0; font-size: var(--text-small); }
.source-notice { padding: var(--space-4); overflow-wrap: anywhere; }
</style>
