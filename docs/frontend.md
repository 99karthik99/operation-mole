# Frontend

Code: `apps/web/src`. Built with React 19, Vite 8, Tailwind CSS v4, TanStack Query 5, React Router and Monaco.

## Routes

| Path                            | Page                   | Purpose                                                 |
| ------------------------------- | ---------------------- | ------------------------------------------------------- |
| `/`                             | `WelcomePage`          | Enter a username (skipped if one is remembered)         |
| `/u/:user`                      | `SessionsPage`         | List, create and delete sessions; switch user           |
| `/u/:user/s/:sessionId`         | `SessionOverviewPage`  | Recent comparisons; repos with Fetch latest; add a repo |
| `/u/:user/s/:sessionId/folders` | `DirectoryComparePage` | Pick Base and Target, compare, browse the tree          |
| `/u/:user/s/:sessionId/files`   | `FileComparePage`      | Monaco diff of two files                                |
| `/u/:user/s/:sessionId/lab`     | `PlaceholderPage`      | Reserved for the next experience                        |
| `/directories`, `/files`        | redirect to `/`        | Links from before sessions                              |

`AppShell` is the layout around every page. It shows the OM logo, the `user › session` breadcrumb, the session navigation (inside a session only) and the theme toggle. It gets the user and session from `useMatch`.

## The URL is the state

Everything needed to rebuild a view is in the URL, so reloads, bookmarks and Back/Forward work:

| What           | Where                                                           |
| -------------- | --------------------------------------------------------------- |
| User, session  | path (`/u/:user/s/:sessionId`)                                  |
| Base side      | `left=/abs/path` **or** `leftRepo=<repoId>&leftBranch=<branch>` |
| Target side    | `right=…` **or** `rightRepo=…&rightBranch=…`                    |
| Current folder | `path=sub/dir` (Folders)                                        |
| Files to diff  | `left=/abs/file&right=/abs/file` (Files)                        |
| Way back       | `from=/u/…/folders?…` (Files; only `/u/…` values are accepted)  |

`lib/sources.ts` converts between the URL and `Source` objects (`sourceFromParams`, `sourcesSearch`). Expanded folders, filters and the selected file are kept in component state only.

The remembered username (`om-user`) and theme (`om-theme`) are in `localStorage`.

## Data fetching

The client is `lib/api.ts`. It turns error responses into `ApiRequestError(message)`, and an unreachable API (including the dev proxy's 502) into a "Can't reach the OM API server" error.

| Query key                                               | Data                                                               |
| ------------------------------------------------------- | ------------------------------------------------------------------ |
| `['sessions', user]`                                    | sessions list                                                      |
| `['session', user, sessionId]`                          | `SessionDetail`, shared by the header, overview and source pickers |
| `['compare-directories', user, sessionId, left, right]` | comparison result (`staleTime: Infinity`; **Rescan** refetches)    |
| `['compare-files', left, right]`                        | file diff                                                          |
| `['defaults']`                                          | default example folders                                            |

`lib/session.ts`'s `useRepoActions` provides the clone and fetch mutations. They put the returned `RepoInfo` straight into the cached session, then refetch it. Running a comparison also refetches the session, so its recent list stays current.

## Main components

| Component      | Notes                                                                                                                                                                                  |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `CompareForm`  | Two `SourcePicker`s, a swap button and Compare. It's remounted (via `key`) whenever the URL's sources change.                                                                          |
| `SourcePicker` | Folder / Git repo toggle; folder path; repo select with **Add a repository…** (URL + Clone); branch select; **Fetch latest**. Its draft type and helpers are in `lib/source-draft.ts`. |
| `CompareTree`  | Rows for Base and Target from one flat list (`lib/tree.ts` `flattenTree`), so both sides stay aligned. Treeitem roles, keyboard support (Enter, arrow keys), hover actions.            |
| `DiffView`     | Monaco `DiffEditor`, lazy-loaded, with Monaco and its worker bundled locally. Read-only. `useInlineViewWhenSpaceIsLimited: false` so the side-by-side button always works.             |
| `ThemeToggle`  | Switches light and dark (`lib/theme.ts`, a `useSyncExternalStore` store). It sets `html[data-theme]`; without a choice, the system setting decides.                                    |
| `Logo`         | The OM mole (`public/favicon.svg`), also used as the browser-tab icon.                                                                                                                 |

## Styling

Tailwind v4 with design tokens in `src/index.css` (`@theme`):

- **Colors:** `--color-left*` (green), `--color-right*` (blue), `--color-modified*` (orange), `--color-error*` (red), plus surface, line, muted and accent tokens.
- **Dark mode:** tokens are redefined under `:root[data-theme='dark']`, and under `prefers-color-scheme: dark` unless light was chosen.
- **`dark:` variant:** a custom variant that covers both of those cases.
