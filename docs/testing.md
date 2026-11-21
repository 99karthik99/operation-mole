# Testing

OM is built **test-first**: write or extend a test, watch it fail for the right reason, then implement. `npm run check` (type check, lint, format check and all tests) must pass before a change is done.

```bash
npm test                                                    # everything
npx vitest run --project server                             # one project: shared | server | web
npx vitest run --project web src/pages/SessionsPage.test.tsx # one file
npm run test:watch                                          # watch mode
```

Vitest runs three projects, set up in the root `vitest.config.ts`:

| Project  | Environment | Location                          |
| -------- | ----------- | --------------------------------- |
| `shared` | node        | `packages/shared/src/*.test.ts`   |
| `server` | node        | `apps/server/test/*.test.ts`      |
| `web`    | jsdom       | `apps/web/src/**/*.test.{ts,tsx}` |

## Server tests: real files, real git

There are no mocks of the filesystem or git, because the edge cases are in how real files and git behave.

| File                                  | Covers                                                                                                                              |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `fixtures.ts`                         | `createWorkspace()` / `writeTree()` build folder trees (files, folders, symlinks, binary) in a temp folder                          |
| `git-fixtures.ts`                     | `createOrigin()` makes a repo with `main`, `dev` and `feature/x`; `commit()` and `git()` helpers. Git runs with an isolated config. |
| `compare-directories.test.ts`         | every status, name clashes, symlinks, errors, ignores, labels                                                                       |
| `files-equal.test.ts`, `sort.test.ts` | byte comparison; sort order                                                                                                         |
| `store.test.ts`                       | sessions, repos, recents (in-memory SQLite, fixed clock)                                                                            |
| `git-service.test.ts`                 | URL validation, clone, branches, worktrees, fetch, clone errors                                                                     |
| `app.test.ts`, `sessions-api.test.ts` | HTTP endpoints through `app.inject`, including git compares end to end                                                              |
| `examples.test.ts`                    | that `examples/` still covers every case and sort rule                                                                              |

Tests that need `file://` clones create the app with `allowedProtocols: ['https', 'ssh', 'file']`.

## Web tests: the whole app, a mocked API

- **`renderApp(url)`** (`src/test/render.tsx`) renders the **real routes** in a memory router with a fresh query client. It returns `location()` and `search()` so tests can check the URL.
- **MSW** (`src/test/server.ts`, `src/test/setup.ts`) mocks the API. Unhandled requests **fail** the test (`onUnhandledFrame: 'error'`), so every request the page makes needs a handler, including the session `GET` the header makes. `src/test/handlers.ts` has shared fixtures (`sessionSummary`, `repoInfo`, `sessionDetailHandler`).
- **Setup:** `matchMedia` is stubbed (light by default; use `stubMatchMedia(true)` for dark), and `localStorage` and `data-theme` are reset before each test.
- **Monaco** can't run in jsdom. `FileComparePage.test.tsx` swaps `DiffView` for a stub, and `DiffView.test.tsx` checks the options it passes to `DiffEditor`.
- **Queries:** prefer role, label and text queries (`getByRole('treeitem', { name })`, `getByLabelText('Base branch')`). They double as accessibility checks.

## In the browser

`.claude/launch.json` defines `dev` (`npm run dev` on port 5180) for the browser preview. Check visual and interaction changes there, in both themes and at a narrow width. Use a throwaway username, and delete its session afterwards so its clones are removed.
