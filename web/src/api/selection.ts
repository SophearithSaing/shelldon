import type { Anchor, QuestionContext, SourceReference } from './contracts/questions.ts'
import type { SourceDiff } from './contracts/source.ts'

/**
 * Compares source coordinates without depending on JSON property order.
 * @param left Original selection.
 * @param right Received selection.
 * @returns Whether both identify the exact same source range.
 */
export function sameAnchor(left: Anchor, right: Anchor): boolean {
  return !!left && !!right && left.kind === right.kind && left.fileID === right.fileID && left.hunkID === right.hunkID && left.side === right.side && left.start === right.start && left.end === right.end
}

/**
 * Resolves a supported selection to original literal source without retargeting it.
 * @param source Complete displayed comparison.
 * @param anchor One hunk or one side's contiguous lines.
 * @returns Pinned context, or null for an unsupported selection.
 */
export function selectionContext(source: SourceDiff, anchor: Anchor): QuestionContext | null {
  if (!anchor || !['hunk', 'lines'].includes(anchor.kind)) return null
  if (anchor.kind === 'hunk' && (anchor.side !== undefined || anchor.start !== undefined || anchor.end !== undefined)) return null
  if (anchor.kind === 'lines' && (!['old', 'new'].includes(anchor.side ?? '') || !Number.isSafeInteger(anchor.start) || !Number.isSafeInteger(anchor.end) || anchor.start! <= 0 || anchor.end! < anchor.start! || anchor.end! - anchor.start! >= 1000)) return null
  const file = source.files.find((item): boolean => item.id === anchor.fileID)
  const hunk = file?.hunks?.find((item): boolean => item.id === anchor.hunkID)
  if (!source.complete || !file || file.kind !== 'text' || !hunk) return null
  const selected = hunk.lines.filter((line): boolean => {
    const coordinate = anchor.side === 'old' ? line.oldLine : line.newLine
    return anchor.kind === 'hunk' || coordinate !== undefined && coordinate >= anchor.start! && coordinate <= anchor.end!
  })
  if (!selected.some((line): boolean => line.sign === '+' || line.sign === '-') || selected.length > 1000 || anchor.kind === 'lines' && selected.length !== anchor.end! - anchor.start! + 1) return null
  const bytes = new TextEncoder().encode([file.oldPath ?? '', file.newPath ?? '', hunk.section, ...selected.map((line): string => line.text), ...hunk.lines.map((line): string => line.text)].join('\n')).length
  if (bytes > 64 << 10) return null
  return { revision: source.revision, revisionID: source.revisionID, anchor: { ...anchor }, oldPath: file.oldPath, newPath: file.newPath, selected, surrounding: hunk }
}

/**
 * Formats an original anchor as plain display text.
 * @param reference Original source reference.
 * @returns Path and side-specific range label.
 */
export function referenceLabel(reference: SourceReference): string {
  const anchor = reference.anchor
  const path = anchor.side === 'old' ? reference.oldPath : reference.newPath ?? reference.oldPath
  return `${path ?? 'Original source'} · ${anchor.kind === 'hunk' ? 'Selected hunk' : `${anchor.side === 'old' ? 'Old' : 'Head'} L${anchor.start}–${anchor.end}`}`
}
