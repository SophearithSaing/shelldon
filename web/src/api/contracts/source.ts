export interface PullRequest {
  id: string
  url: string
  owner: string
  repository: string
  number: string
  title: string | null
  author: string | null
}

export interface Revision {
  prID: string
  baseBranch: string
  baseSource: 'github' | 'user-selected'
  baseSHA: string
  headSHA: string
  mergeBaseSHA: string
}

export interface DiffLine {
  id: string
  sign: ' ' | '+' | '-'
  text: string
  oldLine?: number
  newLine?: number
  noNewline?: boolean
}

export interface DiffRange {
  id: string
  start: number
  count: number
}

export interface DiffHunk {
  id: string
  old: DiffRange
  new: DiffRange
  section: string
  lines: DiffLine[]
}

export interface DiffFile {
  id: string
  status: string
  oldPath?: string
  newPath?: string
  oldMode: string
  newMode: string
  oldObject: string
  newObject: string
  similarity?: number
  kind: string
  reason?: string
  hunks: DiffHunk[] | null
}

export interface SourceDiff {
  revision: Revision
  revisionID: string
  complete: boolean
  files: DiffFile[]
}

export type SourceRequest =
  | { action: 'load' | 'git-only' }
  | { action: 'select-base'; branch: string; sha: string }
  | { action: 'refresh'; revision: Revision }

export interface SourceCandidate {
  branch: string
  sha: string
}

export type SourceResponse =
  | { state: 'ready'; pr: PullRequest; diff: SourceDiff; requestedRevisionID?: string }
  | { state: 'fallback-required'; pr: PullRequest }
  | { state: 'base-selection-required'; pr: PullRequest; candidates: SourceCandidate[] }

export interface OpenResult {
  prID: string
  route: string
}
