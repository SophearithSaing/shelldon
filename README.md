# Sheldon

**Don't just merge it. Understand it.**

A local pull-request explainer. Read pinned changes, ask at the source, practice with a quiz and explore related changes by intent.

The component-first Vue app supports Files changed, shared inline/panel conversations, saved Questions, Quiz and Semantic review. Library and Overview remain Coming soon where backend capabilities are missing. See [frontend ownership, API contracts and verification limits](web/README.md).

## Toolchains

Go **1.26.5** · Node **26.5.0** · npm **11.17.0**

Browser checks also need Playwright Chromium and its system libraries. Tests use offline fixtures, not provider logins or paid requests. Real source loading needs native Git and existing repository access; optional authenticated `gh` resolves the actual PR target. No harness is needed for source browsing. Real questions require an already-installed **OpenCode 2.1.4** with existing provider/default-model configuration; Sheldon does not install or configure it. Current question integration evidence is offline, not a live-provider compatibility claim.

## Develop

Frontend only, with an in-memory development HTTP API and seeded source:

```sh
npm ci --ignore-scripts
npm run dev:web
```

Open <http://127.0.0.1:5173>, enter a GitHub PR URL (for example `https://github.com/acme/platform/pull/248`), then choose **Load pinned source**. This command uses no Go, Git, harness or credentials. Restarting the server resets its development records; reloading the page resets source/understanding but can reopen an already registered PR. Data and middleware live under `web/development/`, outside the production asset graph. The real-backend mode never falls back to development data.

Frontend-only checks (no native tools required):

```sh
npm run typecheck:web
npm run test:web:standalone
```

`npm run typecheck` checks the application/development tooling and browser suites. `npm run test:web` also runs real protected Go HTTP and public-contract checks.

For development against the real backend, keep using two terminals:

```sh
npm ci --ignore-scripts
npm run dev # terminal 1: Vite
```

```sh
SHELDON_DEV_ORIGIN=http://127.0.0.1:5173 go run ./cmd/sheldon # terminal 2: Go
```

UI: <http://127.0.0.1:5173> · backend: `127.0.0.1:7331`. Stop any existing standalone instance first. The CLI opens the authenticated UI; the tab reconnects automatically after refresh using session storage.

Connect the runtime, enter a GitHub PR URL, then choose **Open PR** and **Load pinned source**. The CLI can open another PR in a separate browser tab without replacing the current pinned view. If GitHub metadata is unavailable, explicitly choose **Use Git-only fallback**, then load one of the fetched base branches. No default target is assumed. Registration and source errors are separate; retry is explicit. PR pages offer file filtering, a pinned unified diff, saved Questions, Quiz and Semantic review. Split remains unavailable.

Files changed is one continuous pinned comparison. The tree jumps to a file; scrolling updates the active file without fetching. Source rows render as you approach each file and remain mounted for the page visit; the named render action also opens an unrendered file explicitly. **Mark understood** records reversible, self-reported file progress in page memory only, shared with matching Semantic review. A new displayed revision resets it; answers and quiz checks never mark files understood. The theme switch changes only the page palette; dark is the initial theme. File/group and Conversations rails collapse independently without clearing drafts.

Source syntax uses **GitHub Light** and **Ayu Dark** with the theme switch, including semantic excerpts, pinned context and quiz evidence. Grammars load locally on demand; unsupported or oversized excerpts stay plain text without hiding source. Highlighting never changes source text or diff backgrounds.

For a text diff, choose gutter line numbers (Shift extends on one side within one hunk) or **Select hunk**, then **Ask about selection**. The inline composer is pinned to that file/side/range/revision. **Send question** or Ctrl/Cmd+Enter explicitly starts backend work; Enter inserts a newline. Cancel retains the draft; resume or explicitly discard it before changing its selection or refreshing. Reading other files does not retarget it or permit a second initial draft. Native text selection/copy never submits. Non-text changes have no line questions.

Successful admission adds one marker and opens its inline conversation without expanding the side panel. **Open in panel** and **Show inline** display the same thread, synchronized follow-up draft and streamed, escaped answer text. Hiding either view never stops execution. Pinned context and **Stop this answer** remain accessible. Admission and Stop acknowledgements are not completion proof. Follow-ups use **Enter to send / Shift+Enter for a newline**, respect IME composition, and retain each thread's own transcript and draft when switching threads/files. Model-written citations remain plain text, not trusted navigation links.

The shared revision allows one active question; drafts stay editable while sending is unavailable. Backend busy rejection also covers other tabs; retry is explicit, not synchronized thread-library state or a cross-tab exactly-once guarantee. Rejected requests retain drafts without phantom messages. Uncertain admission disables resending. **Reconnect answer observation** only checks the original answer after stream loss—it never resubmits a question. Closing the panel does not stop execution. Disconnecting a question workspace asks whether to keep connected or explicitly discard page state; it never implies native cancellation. Reload/disconnect clears page-memory drafts, transcripts and markers, not accepted backend execution or saving. Execution and saving have separate statuses: Completed does not mean Saved.

Before sending a native prompt, Sheldon records its submitted question, pinned context and exact shared binding in private `reviews/<id>/threads.json` under the OS data directory. Answers save when execution ends (completed, failed or interrupted), before another question can use that revision. There are no periodic progress writes or shutdown saves/retries: in-progress text stays in memory and is lost on exit, while its submitted question remains saved. Save failure retains runtime text and blocks further questions on that revision. **Retry saving** writes only retained text/status to disk, never resends a question. Drafts remain unsaved. Open **Questions**, then a saved row to reopen history after reload/reconnect/restart, even before loading source. Failed or uncertain native initialization stays unavailable rather than creating another session. No prompt is replayed to recover missing state.

After restart, the first backend history read for a PR (including admission's storage check) classifies its saved Pending/Streaming answers as **Interrupted / execution unknown**, retaining any saved text and original context. This classification is persisted once, without Git/source loading, agent startup or prompt replay; it does not prove native cancellation or idle. Corrupt history or a failed classification save returns an error, never empty healthy history. Current-run answers and existing terminal answers are unchanged.

After an abrupt exit, reopen **Questions** to inspect what was actually saved. Previously saved failed/interrupted partial answers remain readable; an unfinished answer may have no saved output because streaming progress is never written periodically. Missing original source/native state or unresolved prior execution prevents continuation, not reading. Do not resend an old question to recover it.

Use **Refresh saved questions** or **Refresh saved thread** to read other tabs' submissions explicitly. Reads use authenticated, no-store `GET /api/reviews/<pr-id>/threads` and `GET /api/reviews/<pr-id>/threads/<thread-id>`, returning bounded saved data with decimal-string versions and separate current saving/session feedback—never native bindings, host paths or credentials. They start no source or native work. Opening an active/unsaved answer observes only its exact existing answer; it never resends input. Refresh retains live text, drafts and selection. Switching between Questions and Files changed retains the inline draft on its original selection.

Type a **Follow up in this thread** to continue explicitly after restart. Sending verifies the original existing source, native session identity/location/model/restrictions, exact saved input history, terminal idle boundaries and an empty inbox before saving/sending the **new** question. Current model defaults are not consulted. Missing/incompatible source or native state, truncated history and uncertain execution block continuation without replacement, prompt replay or source repair. Saved transcripts and quotes remain readable. Historical Interrupted/unknown answers are not rewritten as completed merely because the session can now continue.

Open **Quiz** to read the saved set without source loading or inference. With pinned source loaded, **Generate quiz** explicitly starts separate restricted agent work; **Regenerate quiz** asks before replacing the current saved set. Select an alternative, then **Check answer** to reveal only that question's saved key, explanation and original evidence, without more inference. Wrong selections stay selected. The current complete set is stored privately in `reviews/<id>/quiz.json`; selections/checks are page-memory only, not saved attempts. Leaving Quiz stops observation, not accepted generation. Cancellation does not promise rollback; after uncertain work use **Refresh saved quiz**, never automatic resend. Agent-generated questions can be inaccurate or ambiguous and never approve a PR or certify understanding.

After reload/reconnect/restart, open **Quiz** again: the saved set reopens unchecked, even when its original cache or harness is unavailable. **See results** summarizes only checked answers; **Try again** clears page-memory practice choices/checks without regeneration or saved attempts. Generation/status are memory-only and are not resumed after restart. Failed generation/cancellation preserves the previous complete set; an uncertain save requires an explicit saved read before another mutation. Source refresh never retargets an older quiz or its checks. The UI labels older revisions and enables **View in original diff** only for matching loaded source. Checking/reopening writes no attempts and does not modify saved conversations. Keep `quiz.json` private: it contains answer keys, explanations and source quotes.

Quiz generation sends compact pinned-repository instructions, not the full diff JSON. Like semantic generation, its separate harness can investigate with restricted Git/gh reads and repository read/search; Sheldon validates returned path/line evidence against its authoritative diff. The old 512-KiB upfront source prompt cap no longer applies. New evidence saves only the exact supporting range, not its entire surrounding hunk or arbitrary nearby lines. A small selection inside a huge hunk can now be used. Each excerpt still has a 200-line / 8-KiB selected-source-and-path budget, with 64 KiB total. Answer keys and grading are unchanged; old saved quizzes with surrounding hunks remain readable without migration. Source-loader and model/time limits remain. See `internal/quiz/README.md` for the exact contract.

`npm run dev:web` serves this same application against local in-memory API handlers. Real-backend/release mode never falls back to development data. The full PR library, Overview metadata and broader configuration are deferred rather than represented by fabricated backend success.

Open **Semantic review** to read saved groups without source loading or inference. With pinned source loaded, **Generate semantic review** explicitly organizes changed ranges across files in separate restricted native context. Regeneration requires confirmation and retains the previous complete result on failure/cancellation. Groups reference verified original code; ungrouped changed lines and non-text changes remain visible, not hidden by a touched-file/hunk count. This is an agent-generated organizing hypothesis, never approval or proof of understanding. Complete results save privately in `reviews/<id>/semantic-review.json`; generation status and reading position are memory-only. Leaving stops observation, not accepted work. After uncertain delivery/saving, explicitly refresh saved state; no automatic resend or shutdown save/retry occurs. Source refresh labels older groups without retargeting them.

With the matching original source loaded, **View in original diff** selects that excerpt's exact file/range. Select gutter lines in an excerpt, then **Ask about selected range** to open the existing inline composer in Files changed; only **Send question** dispatches. The question retains its original single-range anchor and uses the shared question session for that PR revision, not the generation session. A pinned draft/source request blocks this navigation rather than discarding or retargeting it. Old/missing source disables navigation/asking but never erases saved quotes. Whole-group multi-range questions are not implemented.

Semantic generation sends the canonical PR URL and exact pinned commits, not the full diff JSON. Its separate harness can inspect local Git and repository files/search; optional `gh pr view/diff` supplies context only. Sheldon validates returned side-specific paths/lines against its complete original diff. Quiz and semantic generation use the same narrowly allowed Git/GitHub read command profile, with dangerous options denied; question conversations remain read/search-only. These restrictions are best-effort, not a sandbox, and do not alter global configuration. Complete saved/public semantic content supports up to 32 MiB and retained hunks up to 100,000 lines. The existing source loader still limits native Git output to 4 MiB and comparisons to 1000 files; grouping output remains bounded to 32 groups / 128 ranges. Context/time and independent question quote limits still apply; no batching or exhaustive-understanding guarantee.

## Release

Build once, then run one binary (no Node needed at runtime; Ctrl+C stops it):

```sh
npm run build
./bin/sheldon
./bin/sheldon open https://github.com/owner/repo/pull/1
./bin/sheldon --help
```

Windows output: `bin/sheldon.exe`. Plain `go run`/`go build` omit the embedded UI; use Vite for development.

`sheldon open <url>` registers/reuses the PR in private `prs.json` under the OS data directory and opens `/reviews/<id>` on the existing backend. Source loads only after **Load pinned source**; registration/reconnection alone never fetches it. Each browser tab owns its routed PR and displayed revision. Plain `sheldon` opens the real PR entry page. Verified tokens are saved in tab-scoped `sessionStorage`, not `localStorage`, to reconnect automatically after refresh; backend identity is verified again before sending the token. Same-origin JavaScript can access session storage. **Disconnect backend** or a failed reconnection clears the saved token. If storage is blocked or the backend restarts, rerun the command or paste the **API token** printed when the backend starts (also available in private `instance.lock`). Source and unsent drafts are not restored on refresh. The token grants access to the local backend: keep terminal output/logs private. Forwarding to an already-running backend does not print it again.

Choose **Refresh source** to fetch current tips for this tab only. The displayed diff stays readable while loading and on failure; file navigation never refreshes it. Git-only refresh keeps the explicitly selected branch. Existing threads and follow-up drafts retain their original revision/selection; the panel labels older context. Use the Conversations panel's **Choose conversation** selector to reopen retained threads even after their markers no longer belong to the displayed diff. Initial drafts must be finished or discarded before refresh. Commit pinning remains internal—there is no snapshot-history UI or historical-source API. Reload/disconnect clears page-memory source and drafts, not saved history or accepted execution.

Source uses OS cache storage (`~/.cache/sheldon` on Linux, `%LOCALAPPDATA%\sheldon\cache` on Windows), not the project directory. Worktrees and diffs are bounded; unsafe cache state, unavailable history or oversized comparisons produce errors rather than partial source. Existing credential helpers/SSH routes remain trusted. A worktree is not an agent sandbox.

Question backend operations are explicit and authenticated; browsing never starts inference. Execution uses the pinned OpenCode 2.1.4 adapter and existing provider setup, without installing or configuring either. Browser disconnect stops observation, not execution. A worker has a 4m50s deadline plus up to 10s of reconciliation; Stop targets its active answer/session and is not completion proof. Native stream loss permits bounded history checks, never prompt replay. An unknown current outcome blocks that shared revision session; shutdown cancels owned activity. Durable admission alone proves neither native completion nor safe continuation; original-session verification remains mandatory.

## Check & build

Backend-only PR library endpoints support local listing/search and explicit cached GitHub metadata refresh. See the [API contract](internal/httpapi/pr-library.md); the library UI is not connected yet.

```sh
go test -race ./...
go vet ./...
go build ./...
npm run typecheck
npm run build
go test -race -tags=release ./...
go vet -tags=release ./...
```

`npm run build` builds `web/dist/`, copies it to `internal/ui/dist/`, then compiles with `-tags=release`. Generated assets and binaries stay uncommitted.

Browser tests:

```sh
npm exec --workspace=@sheldon/web -- playwright install chromium # first run
npm run test:web
npm run test:release # clean source build + isolated binary/browser checks (Linux/macOS)
npm run test:web:standalone # frontend development HTTP/browser flows only
npm run test:web:backend # real Go instance proof/registration and no-fallback behavior
npm run test:web:contracts # Go validation of public DTO/evidence/key-withholding fixtures
```

Run frontend and release browser suites separately. Current suites keep private generated artifacts in separate `web/test-results/` subdirectories; do not commit or upload them.

[Foundation CI](.github/workflows/ci.yml) runs these checks on Ubuntu 24.04, starting without generated assets. It also compiles Windows/amd64 and macOS/arm64 tests; that is **not native platform validation**. CI never runs live agent experiments and does not upload private test artifacts.

Release browser checks build a disposable application-source copy without `refs/` or existing bundles, using installed dependencies. They remove the copy before running only the binary with private temporary storage and no Node on its PATH. This does not regenerate the repository's embedded assets; run `npm run build` before release-tag Go checks.

The native-source release test needs Go and Git to build disposable tools and local PR objects. It exercises two PRs, explicit Git-only base selection, refresh/retry, restart/cache reuse and active-fetch shutdown through the standalone CLI. Test-only `gh`, Git transport and desktop-opener fixtures stay offline; source HTTP responses are not mocked. No GitHub login, provider setup or live requests are needed.

Current browser checks cover source, conversations/history, quiz and semantic UI/API flows with deterministic development workers, plus real protected Go instance verification and registration. Clean-release checks use actual Git, application HTTP/private storage and synthetic native inference, not application HTTP mocks. They verify durable question admission, targeted Stop, exact-session restart continuation, separate semantic/question services, quiz checking/cancelled replacement and source/native-free saved reopening. Go contract checks reject leaked public keys, foreign evidence and mismatched revision identities.

Browser checks do not certify screen-reader accessibility, live providers, native non-Linux support, sandboxing, exactly-once dispatch or power-loss durability.

Release application processes run only the binary plus offline fixture tools, without Node or `refs/` at application runtime. Saved reopening/checking dispatches no prompts and loads no source; native/Git audits check those boundaries. Real-provider quality and restart compatibility remain unverified.

## Layout

```text
cmd/sheldon/          Go CLI + tests
internal/platform/   OS storage paths
internal/process/    Owned command execution + cancellation
internal/httpapi/    Protected loopback PR/source, question and quiz APIs
internal/app/        Writer lifecycle, PR index, private admissions and source orchestration
internal/githubpr/   Canonical PR/revision contracts (no fetching)
internal/github/     Optional gh target-branch resolution
internal/git/        Managed fetch, pinned worktrees and unified diffs
internal/question/   Durable admission contracts, pinned context and runtime answer execution
internal/quiz/       Pinned structured generation, private sets and public grading projections
internal/semantic/   Validated cross-file grouping, separate generation and saved source inventory
internal/opencode/   Restricted native service/session, execution and history adapter
internal/ui/         Embedded release shell / asset-free development fallback
scripts/build.js     Frontend → embed copy → Go build
web/                 Component-first Vue app + development API + browser tests
```

Further launches reuse the running instance. A private `instance.lock` lives in the OS data directory; do not delete it while Sheldon is running.

Validated on Linux/amd64 only.
