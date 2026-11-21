# CLAUDE.md

Guidance for Claude (and other coding agents) working in this repo. Read this first, then the topic docs in [docs/](docs/README.md).

## What this is

**OM (Operation Mole)** is a local web app for comparing a **Base** and a **Target**: two folders, or two git branches cloned into a per-user **session**. It shows what is identical, different, or present on only one side, and has a Monaco file diff.

- Users identify by **username only** (no passwords). Sessions belong to a user. Each session has its own cloned repos and a list of recent comparisons.
- Experiences: **Folders** (tree compare), **Files** (diff), **Lab** (placeholder for the next experience).

## Commands

```bash
npm install          # once
npm run dev          # API :5181 (node --watch) + web :5180 (Vite). Open http://localhost:5180
npm run check        # typecheck + eslint + prettier --check + all tests. Must pass before you finish.
npm test             # all Vitest projects (shared, server, web)
npx vitest run --project server test/git-service.test.ts   # one file
npm run build && npm start   # production: one server on :5181
```

To check something in the browser, start `.claude/launch.json` → `dev` with the preview tool.

## Layout

```
packages/shared   API types (api.ts) + zod schemas (schemas.ts). Exported as TS source, no build.
apps/server       Fastify. Node runs .ts directly (type stripping). No build step.
  src/app.ts            all routes + error mapping (CompareInputError→400, NotFound→404, Conflict→409)
  src/compare/          folder walk, byte comparison, sort order (sort.ts)
  src/git/              git-service.ts (clone/branches/worktree/fetch), repo-manager.ts (per-session dirs, locks)
  src/store/store.ts    node:sqlite: users, sessions, repos, recent comparisons
  test/                 Vitest. Real temp folders and real git repos (git-fixtures.ts).
apps/web          React 19 + Vite + Tailwind v4 + TanStack Query + React Router + Monaco
  src/routes.tsx        / → Welcome, /u/:user → Sessions, /u/:user/s/:sessionId[/folders|/files|/lab]
  src/lib/              api client, sources (URL⇄Source), session hooks, tree, theme, format
  src/test/             MSW server + handlers, renderApp(url) helper
examples/         left/ (base) and right/ (target): sample data covering every case. Tested by examples.test.ts.
docs/             architecture, API, data model, git, comparison rules, frontend, testing, decisions
```

## How to work here

- **Write tests first.** Write or extend a test, run it and watch it fail for the right reason, then implement. Every behavior change comes with a test.
  - Server: `apps/server/test/*.test.ts`
  - Web: `*.test.tsx` next to the component or page, using `renderApp(url)` and MSW handlers
  - Example data: `examples.test.ts`
- **Finish with `npm run check` passing.** For UI changes, also look at it in the browser preview.
- **TypeScript is strict**, with `erasableSyntaxOnly`. That means:
  - no `enum`, no constructor parameter properties, no namespaces
  - relative imports use `.ts`/`.tsx` extensions
  - no non-null assertions (`!`); use a guard instead
  - eslint is `strictTypeChecked`
- **TypeScript is pinned to ~6.0**, because typescript-eslint doesn't support 7 yet. Don't bump it until it does.
- **Use React 19 event types:** `SubmitEvent<HTMLFormElement>`, not the deprecated `FormEvent`.
- **Libraries:** prefer well-known, stable ones. Adding a dependency is a deliberate choice; mention it.

## Domain rules (keep these true)

- **Statuses:**
  - `identical`, `modified`, `only-left`, `only-right`, `error`. In the UI, _left_ is **Base** and _right_ is **Target**; code and URLs keep `left`/`right`.
  - A folder is `identical` only if everything inside it is identical. A folder on both sides with differences inside is `modified`, shown with an orange dot.
  - A **file and a folder with the same name** are listed as two separate one-sided entries, never `modified`.
- **Sort order:** all folders first, then files. Within each group, `compareNames` in `apps/server/src/compare/sort.ts`: `Intl.Collator('en', {numeric: true, sensitivity: 'base'})`, with code-point order as the tie-break. The server sorts; the UI never re-sorts.
- **Colors:** green = only in base, blue = only in target, orange = different, red = error. Tokens are in `apps/web/src/index.css`.
- **URL is the state:** session in the path; each side as `left=/abs/path` or `leftRepo=<id>&leftBranch=<b>` (same for `right`); current folder as `path=`. Reload must restore the exact view.
- **Git:**
  - The system git runs through simple-git. Each repo is a bare `--filter=blob:none` clone per session, with one worktree per branch.
  - `.git` is ignored at the root of git sides.
  - Nothing fetches automatically; the user clicks **Fetch latest**.
- **Git security (don't weaken):**
  - URLs: https, ssh and scp-style only (`file://` only in tests via `allowedProtocols`).
  - Environment: `GIT_ALLOW_PROTOCOL`, `GIT_TERMINAL_PROMPT=0`, SSH `BatchMode`, and an allowlist of inherited variables (simple-git rejects others such as `GIT_EDITOR`).
  - Usernames are a strict slug; disk paths use generated ids, never raw input.
  - One git operation per repo at a time (lock in `RepoManager`).

## Pitfalls already hit

- **Ports:** 5173 is used by another project on this machine. OM uses **5180** (web) and **5181** (API).
- **`API_PORT`, not `PORT`:** the preview runner sets `PORT=5180`, so the API reads `API_PORT`. Don't switch it back.
- **Never `pkill -f "node src/index.ts"`:** it also kills the dev API, which runs that file under `node --watch`. Stop only the PID you started.
- **`examples/left` and `examples/right` must stay byte-exact.** They're excluded from Prettier and ESLint; never format them.
  - Some cases depend on exact bytes: CRLF, trailing spaces, zero-byte files, symlinks, `résumé.txt`.
  - Git doesn't keep the empty folders `empty-both/` and `empty-in-base/`. `npm install` recreates them (`postinstall` → `scripts/ensure-example-dirs.mjs`); without them `examples.test.ts` fails.
  - `.gitattributes` marks the example data `-text`, so git never changes its line endings.
- **Monaco:**
  - It's bundled locally; the worker import is `monaco-editor/editor/editor.worker?worker` (0.57 exports map).
  - Keep `useInlineViewWhenSpaceIsLimited: false`, or narrow windows silently switch to inline.
- **MSW v3** uses `onUnhandledFrame` (not `onUnhandledRequest`). Unhandled requests fail tests, so every page test needs handlers for every request the page makes, including the session `GET` the header makes.
- **jsdom has no `matchMedia`:** `src/test/setup.ts` stubs it (light by default). `stubMatchMedia(true)` simulates dark mode.
- **No relative URLs in `fetch`:** jsdom's `fetch` rejects them, so the API client builds absolute URLs from `window.location.origin`.
- **Local data:** `.data/` holds the database and clones. It's in `.gitignore`. Delete it to reset local state.

## Docs to update when behavior changes

- [README.md](README.md): setup, run, usage
- [docs/](docs/README.md): design and reference docs (API, data model, comparison rules, …)
- [examples/README.md](examples/README.md): if you add or change an example case (and update `examples.test.ts`)
