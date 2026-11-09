import type { DiffHunk, DiffLine, Revision, SourceDiff } from './source'

export interface EvidenceAnchor {
  fileID: string
  hunkID: string
  side: 'old' | 'new'
  start: number
  end: number
}

export interface Evidence {
  anchor: EvidenceAnchor
  oldPath?: string
  newPath?: string
  selected: DiffLine[]
  surrounding?: DiffHunk
}

export interface GenerationStatus {
  prID: string
  generationID: string
  quizID?: string
  reviewID?: string
  revisionID: string
  sequence: string
  state: 'pending' | 'generating' | 'validating' | 'saving' | 'completed' | 'failed' | 'cancelled' | 'unknown'
  cancelRequested: boolean
  executionUnknown: boolean
  failureCode?: string
  savedVersion?: string
}

export interface QuizQuestion {
  questionID: string
  prompt: string
  choices: { choiceID: string; text: string }[]
}

export interface Quiz {
  quizID: string
  revision: Revision
  revisionID: string
  questions: QuizQuestion[]
}

export interface QuizRead {
  prID: string
  version: string
  quiz: Quiz | null
  generation: GenerationStatus | null
}

export interface QuizChecked {
  prID: string
  version: string
  quizID: string
  revisionID: string
  questionID: string
  choiceID: string
  correct: boolean
  correctChoiceID: string
  explanation: string
  evidence: Evidence[]
}

export interface SemanticGroup {
  groupID: string
  title: string
  explanation: string
  ranges: EvidenceAnchor[]
}

export interface SemanticReview {
  reviewID: string
  diff: SourceDiff
  groups: SemanticGroup[]
}

export interface SemanticRead {
  prID: string
  version: string
  review: SemanticReview | null
  generation: GenerationStatus | null
}

export type GenerationRead = QuizRead | SemanticRead
export type GenerationFeature = 'quiz' | 'semantic-review'
