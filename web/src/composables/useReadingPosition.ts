import { nextTick, onBeforeUnmount, ref, watch } from 'vue'
import type { Ref } from 'vue'

/**
 * Retains a pane's reading offset across visibility and rail-size changes.
 * @param pane Owning scroll element.
 * @param shown Whether this pane currently has its expanded reading surface.
 * @param scope Optional per-thread reading identity within the same pane.
 */
export function useReadingPosition(pane: Readonly<Ref<HTMLElement | null>>, shown: Readonly<Ref<boolean>>, scope: Readonly<Ref<string>> = ref('pane')): void {
  const positions = new Map<string, number>()
  let attached: HTMLElement | null = null

  /** Records actual reading, ignoring layout scroll resets while hidden. */
  function record(): void {
    if (shown.value && pane.value && pane.value.offsetParent !== null) positions.set(scope.value, pane.value.scrollTop)
  }

  /**
   * Attaches a passive listener to the current pane only.
   * @param target Current scroll element.
   */
  function attach(target: HTMLElement | null): void {
    attached?.removeEventListener('scroll', record)
    attached = target
    positions.delete(scope.value)
    attached?.addEventListener('scroll', record, { passive: true })
  }

  /**
   * Restores reading after the pane regains its layout box.
   * @param next New visibility and reading identity.
   * @param previous Previous visibility and reading identity.
   */
  async function restore(next: [boolean, string], previous: [boolean, string]): Promise<void> {
    const [visible, key] = next
    if (visible && previous[0] && pane.value && pane.value.offsetParent !== null) positions.set(previous[1], pane.value.scrollTop)
    if (!visible) return
    await nextTick()
    if (shown.value && scope.value === key && pane.value) pane.value.scrollTop = positions.get(key) ?? 0
  }

  watch(pane, attach, { immediate: true, flush: 'post' })
  watch([shown, scope], restore)
  onBeforeUnmount((): void => attached?.removeEventListener('scroll', record))
}
