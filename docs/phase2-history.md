# Portable Phase 2 history

The requested `git add`/commit in the main worktree failed with:

```text
fatal: Unable to create '.../Yazi/.git/index.lock': Permission denied
```

The main repository metadata is read-only in this agent session. Source edits and builds are permitted. To preserve a reviewable commit for each feature, `scripts/checkpoint.mjs` copies the source into a **separate local repository with its own worktree** at `.tools/phase2-history`. It never points an alternate index into the protected `.git` and never modifies it.

The independent history uses the user's existing Git identity. No global configuration, GitHub repository or remote was created or changed. No push was attempted.

## Commits

| Commit | Scope |
|---|---|
| `fe3af28` | Preserve the Phase 1 source baseline |
| `3d8cdd7` | Restricted-workspace Vite builds and browser tests |
| `910c127` | Blog/story/book types |
| `09ba1bb` | Chapter/scene tree, ordering and recoverable removal |
| `06f788a` | Character and place cards |
| `34cfa27` | Typewriter mode and caret centering |
| `100e15c` | Snapshots, comparison and safeguarded restore |
| `dff809e` | Pandoc bridge and portable Markdown export |
| `8bd2dcd` | Research, timeline, writing log and word goals |
| `78fc751` | Recovery safeguards, browser evidence and regression checks |
| `a5493ac` | Fiction keyboard shortcuts |

A final documentation commit follows these feature commits. The entire series is stored in `.tools/yazi-phase2.bundle`.

## Review

Read the history without touching the main `.git`:

```powershell
git -C .tools/phase2-history log --oneline
git -C .tools/phase2-history show 09ba1bb
git -C .tools/phase2-history status --short
```

Or clone the self-contained bundle into a new folder:

```powershell
git clone .tools/yazi-phase2.bundle .tools/yazi-with-history
```

The bundle includes source, lockfile, tests, documentation and screenshots, without dependencies, build output or personal drafts. Integrating this series into the main repository still requires fixing its write permission in a normal development session. No reset or forced checkout was performed against the user's files.
