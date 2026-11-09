import { readonly, ref } from 'vue'

const path = ref(location.pathname)
let pageGuard: (() => boolean) | null = null

/**
 * Registers one routed page's explicit state-discard decision.
 * @param guard Current page guard.
 * @returns Cleanup that does not remove a newer page's guard.
 */
export function setPageGuard(guard: () => boolean): () => void {
  pageGuard = guard
  return (): void => { if (pageGuard === guard) pageGuard = null }
}

/**
 * Checks whether page-memory state may be discarded without implying native cancellation.
 * @returns Whether the user allowed leaving the page.
 */
export function allowPageLeave(): boolean { return pageGuard?.() ?? true }

/** Synchronizes browser history navigation with the active page. */
function onPopState(): void {
  if (!allowPageLeave()) { history.pushState(null, '', path.value); return }
  path.value = location.pathname
}

window.addEventListener('popstate', onPopState)
if (import.meta.hot) import.meta.hot.dispose((): void => window.removeEventListener('popstate', onPopState))

/**
 * Navigates to a supported application route.
 * @param destination Root or canonical review path.
 */
export function navigate(destination: string): void {
  if (destination !== '/' && !/^\/reviews\/[a-f0-9]{64}$/.test(destination)) return
  if (path.value === destination) return
  if (!allowPageLeave()) return
  history.pushState(null, '', destination)
  path.value = destination
}

export const currentPath = readonly(path)
