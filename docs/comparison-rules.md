# Comparison rules

Code: `apps/server/src/compare/` (`compare-directories.ts`, `files-equal.ts`, `sort.ts`). Each rule is covered by `test/compare-directories.test.ts`, `test/sort.test.ts`, and the real example folders in `test/examples.test.ts`.

## Matching

Entries are matched by **relative path**: `src/a.ts` on the base side is compared with `src/a.ts` on the target side. Files with different names are never paired automatically. In the UI, use **Select for compare** to diff two files with different names.

## Statuses

| Status       | Files and symlinks                                                        | Folders                                                   | UI                                    |
| ------------ | ------------------------------------------------------------------------- | --------------------------------------------------------- | ------------------------------------- |
| `identical`  | Same bytes (symlinks: same target)                                        | Present on both sides and **everything inside** identical | default color                         |
| `modified`   | Different bytes or size (symlinks: different target; a symlink vs a file) | Present on both sides with a difference somewhere inside  | orange row; folders get an orange dot |
| `only-left`  | Only in base                                                              | Only in base (and so is everything inside)                | green                                 |
| `only-right` | Only in target                                                            | Only in target                                            | blue                                  |
| `error`      | Couldn't be read (e.g. permissions)                                       | Couldn't be listed                                        | red, with the error message           |

Details:

- **Byte comparison:** sizes are compared first, so different sizes mean different without reading. Otherwise both files are read in 64 KB chunks until the first difference.
- **A file and a folder with the same name** can't be compared, so they're listed as **two one-sided entries**: the file sorts with the files, the folder with the folders. Opening that path means the folder.
- **Symlinks are not followed.** They're compared by target, and a symlink to a folder has no children.
- **Empty folders** compare as identical when present on both sides.
- **Git sources** skip `.git` at their root.
- **An error inside a folder** makes that folder `modified`.

## Sort order

Every level lists **all folders first, then all files** (including symlinks). Within each group, names use `compareNames`:

```ts
const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });
compareNames = (a, b) => collator.compare(a, b) || (a < b ? -1 : a > b ? 1 : 0);
```

| Rule                                         | Example                                        |
| -------------------------------------------- | ---------------------------------------------- |
| Numbers by value                             | `2` < `10` < `100`; `file2.txt` < `file10.txt` |
| Case ignored                                 | `a.txt`, `B.txt`, `c.txt`                      |
| Accents sort next to the plain letter        | `report.txt`, `résumé.txt`                     |
| Symbols, then digits, then letters           | `_private`, `.config`, `2024-archive`, `Alpha` |
| Equal values: code-point tie-break           | `007` before `7`; `A.txt` before `a.txt`       |
| After a shared prefix, digits before letters | `1.5.txt` before `1.txt`                       |

Only the server sorts; the UI keeps the order it receives. The locale is fixed to English, so every machine gives the same order.

## Summary counts

The summary counts **files and symlinks** by status, including those inside one-sided folders. Folders aren't counted, since they only collect their contents' statuses. A file/folder name clash counts the file as one-sided. Unreadable entries count as errors.

## File diff (Files page)

- **Binary:** a NUL byte in the first 8 KB, the same rule git uses. Binary files show size and SHA-256 instead of a diff.
- **Text:** shown up to 5 MB; larger files show a summary.
- **Identical:** the same byte comparison as above.
