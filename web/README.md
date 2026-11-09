# Frontend implementation

Run commands from the repository root with the pinned Node/npm toolchain:

```sh
npm ci --ignore-scripts
npm run dev:web
```

Open <http://127.0.0.1:5173>, enter a GitHub PR URL, and explicitly load pinned source. This development command starts only Vite and its local HTTP handlers. No Go, Git, OpenCode, credentials or external requests are needed. The application uses normal product UI; library/Overview capabilities without backend contracts say Coming soon.

For the real Go backend, use `npm run dev` and the CLI as documented in the root README. There is one application and one set of browser API clients. No page/component imports fixtures or selects an API mode. Production builds never include the development API or fall back to it on failure.

## Ownership

| Location | Responsibility |
| --- | --- |
| `src/pages/` | Route-level component composition; no page styles |
| `src/layouts/` | Application height, responsive columns and supporting pane geometry |
| `src/components/` | Feature presentation and scoped styles |
| `src/composables/useReview.ts` | Explicit source loading, revision ownership and self-reported progress |
| `src/composables/useConversations.ts` | One canonical thread/turn/draft owner shared by inline, panel and saved history |
| `src/composables/useGeneration.ts` | The finite protocol shared by the two separately owned generation features |
| `src/api/` | Same-origin transport, public DTOs, exact source selection and API operations |
| `src/syntax/` | Lazy Shiki grammars, dual-theme tokens and bounded in-memory caching |
| `src/styles/` | Palette tokens, local fonts and base reset only |
| `development/` | Server-only fixtures, workers, validation and test scenarios |

Source, initial drafts, follow-up drafts, reading position, understanding and quiz practice are page-memory state. Theme/rail/feature changes retain them. A new displayed source revision resets only file understanding; older conversations/results keep their original identities and quotes. Browser reload/disconnect clears page state, not accepted backend work. Development server restart also resets its in-memory records; real private saving remains Go-owned in OS storage.

## Syntax highlighting

Shiki 4.6.0 colors literal source with **GitHub Light** and **Ayu Dark**, following the app's theme switch. `SyntaxText.vue` renders escaped Vue text spans with external CSS classes, never HTML injection or inline token styles. Diff/selection backgrounds and line identities remain unchanged. The JavaScript regex engine needs neither WASM nor an eval exception in the release CSP. Themes, engine and path-selected grammars load from local bundled chunks; no CDN or backend calls are involved.

The same renderer serves Files changed, semantic excerpts/remainder, conversation context and quiz evidence. Each hunk is tokenized as separate old/new source streams, without diff prefixes. Quotes reuse supplied hunk context when available; discontinuous coordinates reset grammar state. Hunk boundaries still omit full-file context, so coloring is best-effort rather than a parser/validation guarantee.

Supported paths cover TypeScript/TSX, JavaScript/JSX, Vue, Go, Python, Rust, JSON/JSONC, YAML, TOML, HTML, CSS/SCSS, Markdown, shell, SQL, Java, C/C++, Ruby, Dockerfiles and GraphQL. Unknown paths, failed grammar loads and oversized excerpts remain plain text. Highlighting is capped at 1,000 rows / 65,536 UTF-16 code units per excerpt and 2,000 per line; no source is truncated. The token cache retains at most 64 entries / 262,144 key code units in memory. The C++ grammar is a larger lazy chunk (about 797 kB minified); it is not part of initial startup and triggers Vite's size advisory.

## Public protocol

All browser API calls use the same `/api/...` paths in both modes. IDs are canonical lowercase digests; versions/sequences stay decimal strings. No native bindings, filesystem locations, answer keys for unchecked questions or credentials belong in public saved projections.

| Operation | Request / response |
| --- | --- |
| `POST /api/open` | `{url}` → 202 `{prID, route}`; registration alone loads no source |
| `GET /api/reviews/<pr>` | Canonical registered PR metadata |
| `POST .../source` | Explicit `load`, `refresh`, `git-only` or `select-base`; complete pinned diff or a required base decision |
| `POST .../questions` | `{revision, anchor, question}` → 202 cumulative `Answer` admission |
| `POST .../threads/<thread>/answers` | `{revisionID, question}`; continues only the original thread |
| `POST .../threads/<thread>/answers/<answer>/events` | `{revisionID}` → `event: answer` SSE cumulative snapshots, never new admission |
| `POST .../answers/<answer>/stop` | Exact-answer acknowledgement; not termination proof |
| `POST .../answers/<answer>/save` | Persistence-only retry; never another prompt |
| `GET .../threads` / `GET .../threads/<thread>` | Saved navigation/detail plus separate current session/saving feedback |
| `GET .../quiz` / `GET .../semantic-review` | Saved content/version and transient generation status; no source loading/inference |
| `POST .../<feature>/generations` | `{revision, expectedVersion}` → 202 pending status |
| `GET .../<feature>/generations/<generation>` | Exact finite status; observed at most once/second, one request in flight |
| `POST .../<feature>/generations/<generation>/cancel` | `{revisionID}`; no rollback promise |
| `POST .../quiz/<quiz>/questions/<question>/check` | `{revisionID, choiceID}` → only that question's key/explanation/original evidence |

Question anchors are one side/range within one hunk or one complete hunk, with changed text and existing quote limits. Excerpt Ask only opens the existing Files changed composer; Send is the explicit admission boundary. Native text selection never sends a question. Whole-group/multi-range questions remain unsupported.

The revision permits one active question; quiz and semantic generation have independent per-PR replacement slots. HTTP rejection retains input without phantom messages. Uncertain admission disables resending. Stream reconnect observes only the original answer. Closing a view does not cancel execution. Completed and Saved are separate states, and saving failure blocks continuation until an explicit persistence retry.

Generation admission/cancellation acknowledgements do not prove completion or rollback. Failure/cancellation retains the prior complete result. An uncertain outcome requires an explicit saved read before another mutation. There is no automatic generation retry, source repair, session replacement or prompt replay. Quiz checking/results/Try again spend no inference and save no attempts.

## Development scenarios

Select a server-wide scenario before startup:

```sh
SHELDON_WEB_SCENARIO=answer-save-failed npm run dev:web
```

Test tooling can select the same scenarios per request with `X-Sheldon-Scenario`; no product controls or production handlers use this header. Available scenarios:

- Source: `source-failed`, `source-fallback`, `source-empty`, `source-nontext`, `large-source` (80 files), `new-revision`.
- Questions: `answer-slow`, `answer-failed`, `answer-unknown`, `answer-save-failed`, `admission-uncertain`.
- Generation: `generation-failed`, `generation-save-uncertain`, `generation-unknown`, `generation-admission-uncertain`.

Accepted local workers run independently of observers. Submitted questions and terminal saved answers are distinct in-memory records; partial streaming text is not periodically written. Server shutdown stops owned development workers. These are development semantics, not proof of OS/power-loss durability or real provider behavior.

## Verification and limits

```sh
npm run typecheck
npm run test:web:standalone # Vite/API/browser only; no Go requirement
npm run test:web:backend    # protected real Go HTTP + Vite, no native inference
npm run test:web:contracts  # development DTOs checked by real Go public validators
npm run test:web            # all three checks above, sequential browser suites
npm run build
npm run test:release        # disposable clean embedded build + actual Git/API/private storage
```

The clean-release suite reuses offline Git/transport/native-protocol tools, not application HTTP mocks. It exercises durable questions, targeted Stop, original-session continuation after app/service restart, quiz checking/cancelled replacement, semantic-to-source questions and saved quiz/groups with original cache/native tools unavailable. Application processes run without Node or `refs/`. Synthetic native answers do not certify live provider compatibility or factual explanation/grouping quality.

Linux/Chromium offline checks do not certify screen-reader accessibility, native non-Linux support, live inference quality, exactly-once dispatch or a sandbox.
