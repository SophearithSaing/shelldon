<script setup lang="ts">
import { usePRLibrary } from '../../composables/usePRLibrary'
import { navigate } from '../../composables/navigation'
import type { LibraryFilter, LibraryLifecycle, LibraryRow } from '../../api/contracts/library'
import AppButton from '../ui/AppButton.vue'
import AppIcon from '../ui/AppIcon.vue'
import StatusMessage from '../ui/StatusMessage.vue'

const library = usePRLibrary()
const filters: { value: LibraryFilter; label: string }[] = [{ value: 'all', label: 'All' }, { value: 'open', label: 'Open' }, { value: 'merged', label: 'Merged' }]
const dateFormatter = new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' })

/**
 * Formats a cached GitHub timestamp without implying review activity.
 * @param value Nullable RFC3339 timestamp.
 * @returns Stable UTC display date, or an empty string when unavailable.
 */
function formatDate(value: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? '' : dateFormatter.format(date)
}

/**
 * Chooses registered display text without inventing unavailable metadata.
 * @param row Library row to present.
 * @returns Cached title or an identity-based fallback.
 */
function displayTitle(row: LibraryRow): string {
  return row.pr.title ?? `Pull request #${row.pr.number}`
}

/**
 * Converts the observed lifecycle to a readable badge label.
 * @param state Cached lifecycle state.
 * @returns Human-readable state.
 */
function lifecycleLabel(state: LibraryLifecycle): string {
  return state.slice(0, 1).toUpperCase() + state.slice(1)
}

/**
 * Describes only metadata availability, never source or review progress.
 * @param row Library row to describe.
 * @returns Cached observation or recovery status.
 */
function metadataLabel(row: LibraryRow): string {
  if (row.metadataStatus === 'missing') return 'Metadata not fetched'
  if (row.metadataStatus === 'unavailable') return 'Metadata unavailable'
  return `Checked ${formatDate(row.fetchedAt) || 'date unavailable'}`
}
</script>

<template>
  <section class="pr-library" aria-labelledby="library-title">
    <header class="library-heading">
      <div><span class="eyebrow">YOUR REVIEW WORKSPACE</span><h2 id="library-title">Pull requests</h2><p>Find a registered PR and pick up your review.</p></div>
      <span v-if="library.pending.value && library.loaded.value" class="updating" role="status">Updating…</span>
    </header>

    <div class="toolbar">
      <nav class="filters" aria-label="PR status">
        <button v-for="filter in filters" :key="filter.value" type="button" :class="{ active: library.state.value === filter.value }" :aria-pressed="library.state.value === filter.value" @click="library.selectState(filter.value)">{{ filter.label }} <span>{{ library.counts.value[filter.value] }}</span></button>
      </nav>
      <form class="search" role="search" @submit.prevent="library.load()">
        <label class="visually-hidden" for="library-search">Search pull requests</label>
        <input id="library-search" v-model="library.search.value" type="search" placeholder="Search pull requests…" maxlength="256" />
        <AppButton type="submit" variant="quiet" :disabled="library.pending.value">Search</AppButton>
      </form>
    </div>

    <StatusMessage v-if="library.error.value" tone="error" class="library-error">
      <div class="error-content"><span>{{ library.error.value }}</span><AppButton :disabled="library.pending.value" @click="library.load()">Reload library</AppButton></div>
    </StatusMessage>
    <StatusMessage v-if="!library.loaded.value && library.pending.value" title="Loading pull requests">Reading this Sheldon instance’s registered library…</StatusMessage>

    <div v-if="library.items.value.length" class="pr-list">
      <div class="list-head" aria-hidden="true"><span>Pull request</span><span>Repository</span><span>Status</span><span>Metadata</span></div>
      <ul>
        <li v-for="row in library.items.value" :key="row.pr.id" class="pr-row">
          <a class="pr-link" :href="row.route" :title="`${displayTitle(row)} #${row.pr.number}`" @click.prevent="navigate(row.route)">
            <span class="pr-icon"><AppIcon name="merge" /></span>
            <span class="pr-copy"><strong>{{ displayTitle(row) }}</strong><span class="pr-meta">#{{ row.pr.number }}<template v-if="row.createdAt"> · opened <time :datetime="row.createdAt">{{ formatDate(row.createdAt) }}</time></template><template v-if="row.pr.author"> by {{ row.pr.author }}</template></span></span>
          </a>
          <a class="repository" :href="row.route" :aria-label="`Open ${row.pr.owner}/${row.pr.repository} pull request ${row.pr.number}`" @click.prevent="navigate(row.route)">{{ row.pr.owner }} <span>/</span> {{ row.pr.repository }}</a>
          <div class="status"><span :class="['state', row.state]">{{ lifecycleLabel(row.state) }}</span><small>{{ metadataLabel(row) }}</small></div>
          <div class="row-action"><AppButton :disabled="library.refreshingID.value !== ''" :aria-label="`Refresh metadata for ${displayTitle(row)}`" @click="library.refresh(row)"><AppIcon name="refresh" />{{ library.refreshingID.value === row.pr.id ? 'Refreshing…' : 'Refresh' }}</AppButton></div>
        </li>
      </ul>
    </div>

    <div v-else-if="library.loaded.value && !library.pending.value" class="empty">
      <strong>{{ library.search.value.trim() || library.state.value !== 'all' ? 'No pull requests match.' : 'No registered pull requests yet.' }}</strong>
      <p>{{ library.search.value.trim() || library.state.value !== 'all' ? 'Try a different search or choose All.' : 'Open a GitHub PR above to add it to this library.' }}</p>
    </div>

    <footer v-if="library.loaded.value" class="library-footer">
      <span>{{ library.total.value }} pull request{{ library.total.value === 1 ? '' : 's' }}<template v-if="library.nextOffset.value !== null"> · {{ library.items.value.length }} loaded</template></span>
      <AppButton v-if="library.canLoadMore.value" @click="library.load(true)">Load more</AppButton>
      <span v-else>Metadata refreshes only when you ask.</span>
    </footer>
  </section>
</template>

<style scoped>
.pr-library { width: min(100% - 40px, 1180px); margin: 24px auto 56px; }
.library-heading { display: flex; align-items: end; justify-content: space-between; gap: 20px; margin-bottom: 24px; }
.eyebrow { color: var(--accent); font-size: 10px; font-weight: 700; letter-spacing: 1.8px; }
h2 { margin: 8px 0 4px; font-size: 30px; line-height: 1.2; letter-spacing: -.7px; }
.library-heading p { margin: 0; color: var(--muted); }
.updating { color: var(--muted); font-size: 11px; }
.toolbar { display: flex; align-items: center; justify-content: space-between; gap: 20px; margin-bottom: 16px; }
.filters { display: flex; align-items: center; gap: 4px; }
.filters button { min-height: 36px; border: 0; border-radius: 6px; padding: 6px 12px; background: transparent; color: var(--muted); font-weight: 600; }
.filters button:hover { background: var(--surface); color: var(--ink); }
.filters button.active { background: var(--paper); color: var(--ink); box-shadow: 0 1px 4px #0002; }
.filters button span { margin-left: 5px; color: var(--muted); font-size: 11px; }
.search { display: flex; align-items: center; gap: 4px; }
.search input { width: min(300px, 35vw); min-height: 38px; border: 1px solid var(--border); border-radius: 7px; padding: 8px 12px; background: var(--paper); color: var(--ink); }
.library-error { margin-bottom: 16px; }
.error-content { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
.pr-list { overflow: hidden; border: 1px solid var(--border); border-radius: 10px; background: var(--paper); }
.list-head, .pr-row { display: grid; grid-template-columns: minmax(0, 1fr) 210px 140px 120px; gap: 16px; align-items: center; }
.list-head { min-height: 40px; padding: 0 20px; border-bottom: 1px solid var(--border); background: var(--surface); color: var(--muted); font-size: 10px; font-weight: 600; letter-spacing: 1px; text-transform: uppercase; }
ul { margin: 0; padding: 0; list-style: none; }
.pr-row { min-height: 82px; padding: 14px 20px; border-bottom: 1px solid var(--border); }
.pr-row:last-child { border-bottom: 0; }
.pr-row:hover { background: color-mix(in srgb, var(--surface) 55%, transparent); }
.pr-link { display: flex; align-items: center; gap: 14px; min-width: 0; color: var(--ink); text-decoration: none; }
.pr-icon { display: grid; place-items: center; flex: 0 0 26px; color: var(--muted); }
.pr-copy { min-width: 0; }
.pr-copy strong { display: block; overflow: hidden; font-size: 14px; text-overflow: ellipsis; white-space: nowrap; }
.pr-meta { display: block; margin-top: 5px; color: var(--muted); font-size: 11px; overflow-wrap: anywhere; }
.repository { min-width: 0; color: var(--muted); font-size: 12px; text-decoration: none; overflow-wrap: anywhere; }
.repository span { color: var(--border-strong); }
.repository:hover { color: var(--accent); }
.status { display: flex; align-items: flex-start; flex-direction: column; gap: 5px; min-width: 0; }
.state { display: inline-flex; align-items: center; border-radius: 99px; padding: 2px 8px; background: var(--surface); color: var(--muted); font-size: 10px; font-weight: 700; }
.state.open { background: var(--added-bg); color: var(--added); }
.state.merged { background: var(--accent-soft); color: var(--accent); }
.state.unknown { background: var(--warning-bg); color: var(--warning); }
.status small { color: var(--muted); font-size: 9px; line-height: 1.3; }
.row-action { display: flex; justify-content: flex-end; }
.empty { padding: 36px 24px; border: 1px solid var(--border); border-radius: 10px; background: var(--paper); text-align: center; }
.empty strong { font-size: 15px; }
.empty p { margin: 6px 0 0; color: var(--muted); }
.library-footer { display: flex; align-items: center; justify-content: space-between; gap: 16px; min-height: 44px; padding-top: 12px; color: var(--muted); font-size: 11px; }
.visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; }
@media (max-width: 900px) {
  .list-head { display: none; }
  .pr-row { grid-template-columns: minmax(0, 1fr) auto; gap: 10px 16px; }
  .pr-link { grid-column: 1 / -1; }
  .pr-copy strong { white-space: normal; }
  .repository { grid-column: 1; padding-left: 40px; }
  .status { grid-column: 1; padding-left: 40px; }
  .row-action { grid-column: 2; grid-row: 2 / 4; align-self: center; }
}
@media (max-width: 700px) {
  .pr-library { width: min(100% - 24px, 1180px); margin-top: 16px; }
  .library-heading { align-items: start; margin-bottom: 18px; }
  .toolbar { align-items: stretch; flex-direction: column; gap: 10px; }
  .filters { display: grid; grid-template-columns: repeat(3, 1fr); }
  .filters button { min-height: 44px; }
  .search input { width: 100%; min-height: 44px; }
  .search { width: 100%; }
  .pr-row { padding: 16px; }
  .row-action { grid-column: 1 / -1; grid-row: auto; justify-content: flex-start; padding-left: 40px; }
  .error-content { align-items: flex-start; flex-direction: column; }
  .library-footer { align-items: flex-start; flex-direction: column; }
}
</style>
