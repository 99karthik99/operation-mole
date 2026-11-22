# Example folders

`left/` (**Base**) and `right/` (**Target**) are the folders OM compares by default. Together they cover every case the app handles. [examples.test.ts](../apps/server/test/examples.test.ts) checks this, so a missing case fails the tests.

## Comparison cases

| Case                                       | Paths                                                                                                                                                  |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Identical files                            | `README.md`, `src/index.ts`, `src/utils/math.ts`, `assets/logo.png` (binary), `whitespace/empty.txt` (0 bytes)                                         |
| Identical folder (default color)           | `vendor/`                                                                                                                                              |
| Identical empty folder                     | `empty-both/`                                                                                                                                          |
| Different text                             | `config.json`, `src/utils/strings.ts`, `docs/changelog.md`                                                                                             |
| Different binary, same size                | `assets/banner.bin`                                                                                                                                    |
| Differs only in whitespace or line endings | `whitespace/trailing-space.txt`, `whitespace/line-endings.txt` (LF vs CRLF)                                                                            |
| Folder containing differences (orange dot) | `src/`, `docs/`, `assets/`, `links/`, `sorting/`, `whitespace/`                                                                                        |
| Only in base                               | `notes.txt`, `docs/legacy/` (folder with files)                                                                                                        |
| Only in base, empty folder                 | `empty-in-base/`                                                                                                                                       |
| Only in target                             | `LICENSE`, `tests/` (folder with files)                                                                                                                |
| Same name: file in base, folder in target  | `output` (listed as two one-sided entries)                                                                                                             |
| Symlinks                                   | `entry` and `links/same-target` (identical), `links/changed-target` (different target), `links/only-in-target`, `links/link-or-file` (symlink vs file) |

## Sort order

Every level lists folders first, then files. Each group is in natural, case-insensitive ascending order. `sorting/` shows the rules, with entries from both sides mixed in one list:

| Rule                                         | Example                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------ |
| Symbols come before numbers and letters      | `_private`, `.config` … `_notes.txt`, `.env`                                         |
| Numbers sort by value                        | `v2` before `v10`, `9-nine.txt` before `10-ten.txt`, `file2.txt` before `file10.txt` |
| Case is ignored                              | `a.txt`, `B.txt`, `c.txt` and `Alpha`, `beta`, `Zulu`                                |
| Accented letters sort with their base letter | `report.txt`, `résumé.txt`                                                           |
| Spaces are allowed in names                  | `my notes.txt`                                                                       |

### Folders with numeric names

`numbered/` holds folders named only with numbers. They sort by value: `1`, `2`, `3`, `007`, `7`, `10`, `20`, `100`, `1000`. `007` and `7` have the same value, so the tie-break puts `007` first. The folders are spread across both sides:

| Status         | Folders                  |
| -------------- | ------------------------ |
| Identical      | `1`, `007`, `10`, `1000` |
| Different      | `2`                      |
| Only in base   | `3`, `100`               |
| Only in target | `7`, `20`                |

At the root, `2024/` (identical) and `2025/` (only in target) sort before the lettered folders.

### Files with numeric names

`numbered/` also has numeric files, listed after its folders and sorted by value: `1.5.txt`, `01.txt`, `1.txt`, `2.txt`, `3.csv`, `5`, `10.txt`, `20.md`, `50`, `100.txt`, `1000.log`. The set includes names with no extension (`5`, `50`), a zero-padded name (`01.txt` comes right before `1.txt`), and a version-style name. `1.5.txt` comes first because after the shared `1.`, the digit `5` sorts before the letter `t`.

| Status         | Files                                   |
| -------------- | --------------------------------------- |
| Identical      | `01.txt`, `1.txt`, `10.txt`, `1000.log` |
| Different      | `2.txt`, `50`                           |
| Only in base   | `1.5.txt`, `20.md`                      |
| Only in target | `3.csv`, `5`, `100.txt`                 |

At the root, `404.html` (identical) sorts before the lettered files.

## Not covered here

- **Unreadable files** (shown red as errors): a permission-locked file can't be stored in the repo. The server tests cover this case with a temporary file.
- **Files too large to display** (over 5 MB): left out to keep the repo small. The API tests cover this case with a lower limit.
- **Empty folders and git**: git doesn't store empty folders, so `pnpm install` recreates `empty-both/` and `empty-in-base/` (`scripts/ensure-example-dirs.ts`, run as `postinstall`).
