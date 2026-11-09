# PR library API

The library contains only PRs registered through `POST /api/open` or the CLI, not a GitHub inbox. Frontend integration is not included. Both endpoints use existing bearer, Host and Origin protections and return `Cache-Control: no-store`. Errors contain a fixed `error` string, never native output or private paths.

## Read local library

`GET /api/reviews?q=refresh&state=all&limit=50&offset=0`

| Parameter | Contract |
| --- | --- |
| `q` | Optional trimmed case-insensitive substring, at most 256 UTF-8 bytes; matches cached title, canonical `owner/repository` or decimal PR number; optional leading `#` for number search |
| `state` | `all` (default), `open`, `merged` |
| `limit` | Canonical decimal integer, 1–100; default 50 |
| `offset` | Canonical decimal integer, 0–1,000,000; default 0 |

Unsupported/duplicate parameters, malformed encoding and invalid values return 400. Closed-unmerged and unknown states remain discoverable in All; they never count as Open or Merged.

200 response:

```json
{
  "items": [],
  "total": 0,
  "counts": {"open": 0, "merged": 0, "closed": 0, "unknown": 0, "all": 0},
  "nextOffset": null
}
```

Each item contains:

- `pr`: existing `PullRequest` shape (`id`, `url`, `owner`, `repository`, decimal-string `number`, nullable `title`/`author`).
- `route`: existing `/reviews/<id>` route; navigation alone does not load source.
- `state`: `open`, `merged`, `closed` or `unknown`.
- `metadataStatus`: `missing`, `cached` or `unavailable`.
- Nullable UTC `createdAt`, `updatedAt`, `mergedAt`, `fetchedAt`. `fetchedAt` means last successful saved observation, not review activity or source freshness. There is no expiry/automatic refresh.

Counts apply after search but before lifecycle filtering/paging; total applies after search and lifecycle filtering. Sort is canonical `owner/repository`, numeric PR number, then ID. `nextOffset` is null at the end. Concurrent registration/refresh may change subsequent pages; no snapshot consistency is promised.

Reads launch no Git/gh/harness, load no source and perform no saved-history classification or writes. Missing registry returns an empty list without creating it. Corrupt registry returns 500, not an empty healthy list. Missing metadata is normal. Unsafe/corrupt metadata retains its registered row with unknown state, unavailable metadata and legacy registry title/author fallback; invalid sidecar fields are never projected.

## Explicit metadata refresh

`POST /api/reviews/<id>/metadata/refresh`, `Content-Type: application/json`, body `{}`.

One bounded, noninteractive `gh api` GET uses existing GitHub access. No login, harness, inference, Git fetch, worktree creation or pinned-source mutation occurs. Only one refresh per PR is admitted at a time. The request has an eight-second deadline plus owned-process cleanup; it is cancelled on request/server cancellation. There is no automatic retry or background polling.

200 returns the saved library row. This proves only that display metadata was saved, not that displayed source is current. Failure retains prior complete metadata; after uncertain delivery/save failure, reread the library before explicitly retrying.

| Status | Meaning |
| --- | --- |
| 400 / 413 / 415 | Invalid JSON object/unknown fields/trailing data, oversized body (>4096 bytes), or non-JSON media |
| 404 | Invalid/noncanonical route, query parameters or unregistered PR |
| 409 | Refresh already active for this PR |
| 500 | Registry/private storage failure; no refresh success is reported |
| 502 | GitHub/gh unavailable, access denied, rate limited, oversized or invalid upstream response |
| 503 | Capability unavailable or request cancelled |
| 504 | Refresh deadline exceeded |

## Persistence and limits

Membership remains in existing schema-v1 `prs.json` (4-MiB limit). Duplicate registration remains a disk no-op. Optional `reviews/<id>/pr-metadata.json` is a private, bounded (16 KiB), schema-v1 display observation. Both live in OS data storage, independent of disposable source caches.

Metadata validates identity, bounded title/author, lifecycle/merge consistency and UTC timestamps. Saves use checked managed parents and a private synced temporary followed by replacement. Corrupt/future/unsafe existing metadata is preserved and blocks replacement; it is not automatically repaired or re-permissioned. No durable reader progress, last-visited state or cross-file migration is added. Atomic replacement is not a power-loss durability guarantee.

Listing validates the bounded registry and reads sidecars before filtering/paging. It does not scan transcripts or Git caches. A Linux warm-filesystem benchmark with 1,000 cached PRs measured about 64 ms/read and 9.8 MB allocated/read (three iterations); this is not a cold-disk, maximum-registry or other-platform performance guarantee.

## Focused checks

```sh
go test ./internal/githubpr ./internal/github ./internal/httpapi
go test ./internal/app -run 'TestPRLibrary|TestRefreshPRMetadata'
go test ./internal/app -run '^$' -bench BenchmarkPRLibrary1000 -benchtime=3x -benchmem
```

Fixtures exercise protected application HTTP, private storage, offline gh success/failure/cancellation, restart reopening and unavailable tools. No live GitHub/provider compatibility or native non-Linux validation is implied.
