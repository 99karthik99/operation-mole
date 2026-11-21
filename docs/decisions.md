# Decisions

Key choices and their trade-offs. Add an entry when you make a decision that someone might later want to reverse.

### 1. Local server, not browser-only

**Decision:** a Node API reads folders and runs git; the browser only displays results.
**Why:** it handles large folders and real paths, git needs a real filesystem and the machine's credentials, and byte comparison is fast server-side.
**Trade-off:** anyone who can reach the API can read local files with the server's permissions, so it binds to `127.0.0.1` by default.

### 2. Match by relative path; byte-for-byte equality

**Decision:** entries are paired by relative path and are equal only if their bytes are identical. A rename shows as one entry only in base and one only in target.
**Why:** this is what was asked for, and it's predictable.
**Trade-off:** no rename detection. _Select for compare_ covers diffing two files with different names.

### 3. A file and a folder with the same name are two entries

**Decision:** they're listed as two one-sided entries rather than one "modified" entry.
**Why:** they can't be compared, and "modified" suggested a diff that doesn't exist.

### 4. Folders first, natural case-insensitive order, fixed locale

**Decision:** `Intl.Collator('en', { numeric: true, sensitivity: 'base' })` plus a code-point tie-break, applied on the server only.
**Why:** this is the order users asked for. A fixed locale gives the same order on every machine.

### 5. Username-only identity

**Decision:** no passwords; a username is just a namespace for sessions.
**Why:** OM is a local or trusted-network tool, and accounts would add friction.
**Trade-off:** anyone who knows a username can open its sessions. Add real authentication before exposing OM more widely.

### 6. System git via simple-git; bare, blob-less clones with worktrees

**Decision:** run the machine's `git` instead of a JavaScript git library. Each repo is a bare `--filter=blob:none` clone per session, with one worktree per branch.
**Why:** SSH keys and credential helpers work as they do in a terminal (isomorphic-git can't use SSH). Blob-less clones keep large repos fast, and worktrees let two branches of one repo be compared at once.
**Trade-off:** git must be installed on the server.

### 7. Fetching is manual

**Decision:** clones are reused as is; **Fetch latest** updates them.
**Why:** the user chose predictable, fast comparisons over always-current ones.

### 8. Node's built-in SQLite

**Decision:** `node:sqlite` for users, sessions, repos and recents.
**Why:** no native module to build and no separate database. It's reliable enough for a single-process local app.
**Trade-off:** requires Node 22.5 or later; the project targets 24+.

### 9. The URL holds view state

**Decision:** session, sources, branches, current folder and file paths are all in the URL.
**Why:** reloads must land in the same place (an explicit requirement), and links can be shared or bookmarked.

### 10. Run TypeScript directly on the server

**Decision:** Node's type stripping runs `apps/server` and `packages/shared` directly. TypeScript is used with `erasableSyntaxOnly`.
**Why:** no build step and no source maps to manage for the server.
**Trade-off:** no enums or parameter properties, and relative imports must use `.ts` extensions.

### 11. TypeScript pinned to 6.0

**Decision:** `typescript@~6.0`.
**Why:** typescript-eslint, needed for type-aware linting, didn't yet support TypeScript 7. Revisit when it does.

### 12. Monaco bundled locally

**Decision:** Monaco and its worker are bundled by Vite and lazy-loaded on the Files page, with no CDN.
**Why:** works offline and avoids third-party requests. It's a large chunk, but only loaded when needed.

### 13. Names: OM, Base and Target

**Decision:** the app is **OM (Operation Mole)**. The UI calls the sides **Base** and **Target**; code and URLs keep `left`/`right`.
**Why:** the names describe each side's role. Keeping `left`/`right` in code avoided churn and kept old links working.
