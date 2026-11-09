import { onBeforeUnmount, shallowRef, watch } from 'vue'
import type { Ref, ShallowRef } from 'vue'
import type { DiffLine } from '../api/contracts/source'
import type { SyntaxToken } from '../syntax/highlighter'
import { sourceLanguage } from '../syntax/languages'

/**
 * Highlights old/new source independently and resets grammar state across omitted ranges.
 * @param lines Original hunk or quote context, never prefixed patch text.
 * @param oldPath Original-side repository path.
 * @param newPath Head-side repository path.
 * @returns Tokens by original line identity, with immediate plain-text fallback.
 */
export function useSyntaxHighlighting(lines: Readonly<Ref<DiffLine[]>>, oldPath: Readonly<Ref<string | undefined>>, newPath: Readonly<Ref<string | undefined>>): ShallowRef<Record<string, SyntaxToken[]>> {
  const tokens = shallowRef<Record<string, SyntaxToken[]>>({})
  let epoch = 0

  /** Updates only the current mounted excerpt; source remains visible during grammar loading. */
  async function update(): Promise<void> {
    const request = ++epoch
    tokens.value = {}
    const original = lines.value
    if (original.length > 1000 || original.reduce((size, line): number => size + line.text.length, 0) > 64 << 10) return
    const result: Record<string, SyntaxToken[]> = {}
    try {
      for (const side of ['old', 'new'] as const) {
        const language = sourceLanguage(side === 'old' ? oldPath.value ?? newPath.value : newPath.value ?? oldPath.value)
        if (!language) continue
        const groups: DiffLine[][] = []
        for (const line of original) {
          const coordinate = side === 'old' ? line.oldLine : line.newLine
          if (coordinate === undefined) continue
          const previous = groups.at(-1)?.at(-1)
          const last = previous && (side === 'old' ? previous.oldLine : previous.newLine)
          if (last === undefined || coordinate !== last + 1) groups.push([])
          groups.at(-1)!.push(line)
        }
        const { highlightSource } = await import('../syntax/highlighter')
        if (request !== epoch) return
        for (const group of groups) {
          const highlighted = await highlightSource(language, group.map((line): string => line.text).join('\n'))
          if (request !== epoch) return
          if (highlighted) group.forEach((line, index): void => { if (side === 'new' || line.newLine === undefined) result[line.id] = highlighted[index] ?? [] })
        }
      }
      if (request === epoch) tokens.value = result
    } catch { if (request === epoch) tokens.value = {} }
  }

  watch([lines, oldPath, newPath], update, { immediate: true })
  onBeforeUnmount((): void => { epoch++ })
  return tokens
}
