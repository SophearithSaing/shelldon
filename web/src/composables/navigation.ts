import { readonly, ref } from 'vue'

const path = ref(location.pathname)

/** Synchronizes browser history navigation with the active page. */
function onPopState(): void {
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
  history.pushState(null, '', destination)
  path.value = destination
}

export const currentPath = readonly(path)
