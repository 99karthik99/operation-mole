# Git integration

Code: `apps/server/src/git/git-service.ts` (talks to git) and `apps/server/src/git/repo-manager.ts` (sessions, folders, locking).

## Why the git command line

OM runs the machine's own `git` through [simple-git](https://github.com/steveukx/git-js). Private repos then work exactly as they do in a terminal on that machine, through its SSH keys, agent and credential helpers. OM never asks for or stores credentials.

## Clones and branches

| Step               | Command(s)                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------- |
| Clone              | `git clone --bare --filter=blob:none --quiet <url> <repoDir>`                                                       |
| List branches      | `git for-each-ref --format=%(refname:short) refs/heads`, sorted by `compareNames`                                   |
| Default branch     | `git symbolic-ref --short HEAD` (falls back to the first branch)                                                    |
| Check out a branch | `git rev-parse --verify refs/heads/<b>^{commit}`, then `git worktree add --detach <dir> <sha>`                      |
| Update a checkout  | if the worktree's `HEAD` isn't at the tip: `git checkout --force --detach <sha>` and `git clean -fdx`               |
| Fetch latest       | `git fetch --prune origin +refs/heads/*:refs/heads/*`, then update `HEAD` from `git ls-remote --symref origin HEAD` |

Notes:

- **Bare and blob-less clones:** cloning only downloads history, and file contents arrive when a branch is checked out. Large repos stay quick to add, and one clone serves every branch.
- **Detached worktrees:** each branch gets its own folder, so Base and Target can be two branches of the same repo at once. Worktrees are detached, so fetching can move any branch.
- **Reuse:** a checkout already at the branch tip is used as is. Comparing again after a fetch moves it to the new tip.
- **Manual freshness:** nothing fetches on its own. Users click **Fetch latest** (in the Folders picker or the session overview).
- **`.git` is hidden:** a worktree has a `.git` file at its root. It's skipped when comparing git sources, so it never shows as a difference.

## Locking

`RepoManager` runs at most one git operation at a time per `(session, repo URL)`: clone, fetch or checkout. Two quick compares or a fetch during a checkout therefore can't corrupt a repo. Different repos and sessions run in parallel.

## Security

| Risk                                                     | Mitigation                                                                                                                                                                          |
| -------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Local files or dangerous transports (`file://`, `ext::`) | `validateUrl` accepts only `https://`, `ssh://` and `user@host:path`. `GIT_ALLOW_PROTOCOL` also restricts what git itself may use, including submodules.                            |
| Option injection (`--upload-pack=…`)                     | URLs starting with `-` or containing whitespace are rejected. URLs are passed as arguments, never through a shell.                                                                  |
| Hanging on a password or host-key prompt                 | `GIT_TERMINAL_PROMPT=0`, and `GIT_SSH_COMMAND=ssh -o BatchMode=yes` unless one is already set.                                                                                      |
| Inherited git environment changing behavior              | Only `PATH`, `HOME`, `USER`, `LOGNAME`, `LANG`, `LC_ALL`, `TMPDIR`, `SSH_AUTH_SOCK` and proxy variables are passed on. simple-git also rejects unexpected ones (e.g. `GIT_EDITOR`). |
| Path traversal through names                             | Folders on disk use generated ids. Usernames are a strict slug. Branches are checked against `refs/heads/` and URL-encoded for folder names.                                        |
| Using another user's repo                                | Every git source is checked against the requesting user's session and that session's repos (404 otherwise).                                                                         |

Tests enable `file://` with `allowedProtocols: ['https', 'ssh', 'file']` so they can clone local repos. The app never enables it.

## Errors users see

| Situation                              | Message                                            |
| -------------------------------------- | -------------------------------------------------- |
| Bad URL                                | `Invalid repository URL: …`                        |
| Clone fails (not found, auth, network) | `Could not clone <url>: <git's error line>`        |
| Fetch fails                            | `Could not fetch: <git's error line>`              |
| Branch deleted or never fetched        | `Branch "<b>" not found. Try fetching the latest.` |
