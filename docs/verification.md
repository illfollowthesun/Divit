# Verification checkpoint

## Passed locally

`npm.cmd test`: 14 tests, 14 passed, no skips. Runs Node with TypeScript stripping so the production draft-session code is exercised directly.

- Turkish slug transliteration and invalid/path traversal addresses.
- Unicode and escaped frontmatter; essay type; required title/text/date.
- Read-only transfer planning.
- Dirty tree, existing address/branch and missing image rejection.
- Branch creation, successful content check, only expected paths in the local commit; no remote or push.
- Failed content check: original HEAD retained and new files left for review.
- Real site's sharp and `scripts/lib/exif.mjs`: 3100 px image with orientation/GPS/serials; output ≤2560 px, upright, camera/lens fields kept, GPS/serials removed, source buffer unchanged.
- Actual Keystatic posts reader and configuration read exported frontmatter successfully, preserving the Turkish title, place, tags and standfirst.
- Draft-session tests: edits during an in-flight save, failure and retry without losing text, refusing to switch unsaved drafts, stable state across backend property ordering, serial concurrent flushes.
- Changed content-check commands and occupied image paths stop before branch creation; Windows device-name addresses are rejected.
- Full local image transfer with the actual sharp/EXIF tools: exact image-reference replacement, privacy checks on emitted files, and byte-identical originals retained.

Git integration tests run only in `.tmp/publish-*` fixtures, never in the real site repository. Fixtures are intentionally retained for inspection. The actual site was only read for schema, sample frontmatter and EXIF implementation.

## Blocked by environment

`npm.cmd install` could not access the registry; the available cache lacks CodeMirror/Tauri and other required packages. Offline installation reports `ENOTCACHED`. The environment explicitly disables shell network access. No sandbox escalation or permission bypass was attempted.

Rust/cargo are absent from PATH and the usual cargo location. Visual Studio's tool inventory did not find the MSVC C++ component. A workspace-local Rust download failed because the network is unavailable.

The site's existing TypeScript compiler and React declarations were used for a partial source check. Missing packages prevent a full type check; this is not a successful production build. Rust tests, installer creation and runtime behavior cannot be claimed without the missing tools.

All seven application TypeScript/TSX files parse without syntax errors. The shared types and production draft-session module pass a full strict TypeScript check with the locally available compiler. The partial React type check reports only unavailable dependency modules. This does not verify those dependencies' actual API types. Four browser integration tests are present under `tests/ui`; they were not run because Playwright and the app packages cannot be installed.

The prerequisite checker was executed and confirms Node/npm/Git are available while app packages, Cargo, rustc and the MSVC C++ component are missing. `preview.cmd` is prepared for the user's normal Windows session: install packages, verify the frontend build, then open Vite. Its end-to-end behavior is pending the same initial downloads. The desktop revision check and native recovery-backup changes also remain unverified until Rust tests can run.

## Required next verification

1. Install Node dependencies and generate/review `package-lock.json` in a network-enabled environment.
2. `npm.cmd run build`; `cargo test --manifest-path src-tauri/Cargo.toml`.
3. Run the desktop app: create two drafts, type while autosave runs, switch and restart; edit a draft externally and confirm conflict handling; archive/restore both writing and ideas.
4. Add real JPEG/PNG/WebP/AVIF images, insert at the cursor and check preview; confirm originals remain untouched.
5. Check light/dark themes, keyboard controls and 125–150% Windows scaling.
6. In a separate site checkout, send a post with images; run the real content check, inspect exact commit paths and image metadata. Only then use the live site working tree.
7. Build/install/uninstall the NSIS package; verify desktop/start-menu shortcuts, installer size and preservation of Documents data.
8. Emir completes a real post in Yazı. This remains the first-phase acceptance gate.
