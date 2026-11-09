import type { DiffHunk, DiffLine, Revision } from './source'

export interface Anchor {
  kind: 'lines' | 'hunk'
  fileID: string
  hunkID: string
  side?: 'old' | 'new'
  start?: number
  end?: number
}

export interface SourceReference {
  revisionID: string
  anchor: Anchor
  oldPath?: string
  newPath?: string
}

export interface QuestionContext extends SourceReference {
  revision: Revision
  selected: DiffLine[]
  surrounding: DiffHunk
}

export interface Answer {
  answerID: string
  threadID: string
  prID: string
  revisionID: string
  question: string
  text: string
  state: 'pending' | 'streaming' | 'completed' | 'failed' | 'interrupted'
  stopRequested: boolean
  executionUnknown: boolean
  failureCode?: string
  reference: SourceReference
  persistence?: 'saved' | 'saving' | 'failed'
  savedVersion?: string
}

export interface ThreadSummary {
  threadID: string
  revisionID: string
  question: string
  oldPath?: string
  newPath?: string
  anchor: Anchor
  answerCount: number
  state: Answer['state']
  executionUnknown: boolean
  persistence: string
}

export interface ThreadList {
  prID: string
  version: string
  threads: ThreadSummary[]
}

export interface ThreadDetail {
  prID: string
  version: string
  threadID: string
  revisionID: string
  context: QuestionContext
  answers: Answer[]
  persistence: string
  session: { state: string; reason: string }
}
