# Verification checkpoint: Phase 2

## Passed in this session

- `npm.cmd run build -- --logLevel error`: complete strict TypeScript check and Vite production build.
- `npm.cmd test`: 27 tests passed, no skips.
- `npm.cmd run test:ui`: 12 tests passed in installed Google Chrome, with isolated browser storage.

Node coverage includes draft save serialization, failure/retry without text loss, Turkish slug/frontmatter and the real Keystatic reader, real sharp/site EXIF privacy processing, isolated site branch/commit checks, full image transfer without changing originals, chapter/scene order and cross-chapter movement, recoverable section removal, immutable snapshots and safeguarded restoration, word-count writing logs, Markdown export, and converter process arguments.

Browser coverage includes the original blog/idea/trash/theme flows plus persistent story/book types, independent chapter/scene text, section set-aside/restore, character/place cards, actual caret centering in Typewriter mode, side-by-side snapshot comparison and restoration, research/timeline/word goals, and a real Markdown download through the local export bridge. No uncaught page error occurred in the screenshot workflow.

## Actual preview artifacts

- [Book outline and character cards](screenshots/phase2-book.png)
- [Chapter snapshot comparison](screenshots/phase2-snapshots.png)
- [Typewriter and focus](screenshots/phase2-typewriter.png)
- [Export with a completed Markdown download](screenshots/phase2-export.png)
- [Compact 960 x 633 viewport](screenshots/phase2-compact.png)
- [Actual exported Markdown](examples/the-last-ferry.md)

Screenshots were captured through real UI actions with synthetic fiction in an isolated browser profile. Existing user preview drafts were not read, replaced or cleared. The compact viewport exercises the logical space of a 1440 x 950 display at 150% scaling and has no page-level horizontal overflow. This is browser layout evidence, not a claim that native Windows DPI behavior was tested.

## Pending native and converter verification

Rust/cargo and the Microsoft C++ build component are absent. Five native storage tests are present, including structured Markdown/card/note storage and physical trash/restore, interrupted-write recovery, outside-edit conflicts, immutable snapshots and invalid paths. These tests have not run; native IPC, file moves, Windows packaging and installer shortcuts remain unverified.

Pandoc and PDF engines are absent from PATH and common local installation paths. DOCX/EPUB/PDF process-contract tests use an explicitly labelled test converter to verify Unicode stdin, format flags, output paths and non-overwriting copies. They do not prove that actual Word/EPUB/PDF files render correctly. Markdown was exported with the plain-Markdown fallback and its real downloaded content was checked. Install Pandoc and a supported PDF engine, then verify real outputs before calling the Phase 2 acceptance milestone complete.

## Repository history

The main `.git/index.lock` write was denied by the environment. No attempt was made to change or bypass the protected metadata. Feature commits were created in a separate copied worktree with its own repository under `.tools/phase2-history`; `.tools/yazi-phase2.bundle` preserves that history. No main-repository commit or push is claimed. See [history and review](phase2-history.md).

## Remaining acceptance steps

1. Run `cargo test --manifest-path src-tauri/Cargo.toml` with Rust/MSVC installed, then start the desktop app and exercise the same flows against Documents/Yazi.
2. Verify physical scene/card/note trash moves and restore, snapshot immutability, outside-edit conflicts and interrupted-save recovery in a disposable data folder.
3. Install Pandoc plus Typst or another supported PDF engine. Render and inspect real DOCX/EPUB/PDF files, including Turkish text and images.
4. Check native Windows 125% and 150% scaling and build/install the NSIS package.
5. Emir finishes a story in Yazi and exports a PDF. This is the Phase 2 acceptance gate.
