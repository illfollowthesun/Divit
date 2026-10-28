# Yazı implementation plan

Source brief: `ORTAK_BEYIN/promptlar/2026-10-29_yazi_app.md`. Approved by Emir on 29 October 2026. This supersedes the earlier Blog Studio direction.

## Decisions

- Tauri 2 + Rust for the local desktop boundary; React + TypeScript + Vite inside, CodeMirror 6 for Markdown. Native WebView2 avoids shipping a browser engine.
- Plain Markdown/JSON in the user's Documents folder; stable IDs, optimistic concurrency, recoverable atomic writes. No database required to recover a draft with ordinary tools.
- Original images remain local. The site transfer bridge uses the site's existing Node/sharp installation and imports its EXIF code directly. No duplicated privacy implementation or bundled Node runtime.
- AI checks are comments only, planned for phase 3. Claude Code is the default; Anthropic and Ollama adapters are deferred with the checks. No AI integration or network call is currently exposed in the writing flow.
- Warm paper, rust `#8C4228`, Newsreader and IBM Plex; English UI, any writing language. Local font packages, dark appearance, visible keyboard focus.

## Source layout

`src/editor` owns CodeMirror and sanitized preview. `src/shared` owns types, the desktop/preview adapters, and the directly tested draft session that serializes saves. `src/App.tsx` connects the first-phase rooms and dialogs. `src-tauri/src/storage.rs` owns the filesystem and recovery policy; `main.rs` owns IPC and the restricted Node bridge. `scripts/site-bridge.mjs` owns site checks, serialization, image preparation and Git. `scripts/doctor.mjs` checks local prerequisites without changing them. `tests` contains isolated publishing fixtures and draft-session regressions.

## Phase 1

Editor and companion, metadata, preview, autosave, focus, idea capture/board/tag filters, image import/insertion, trash/restore, local site checklist and branch commit, Windows installer configuration. Acceptance: Emir writes one real post from an idea to a checked local site commit in Yazı.

The site's actual schema includes `kind`, cover and optional layout fields beyond the brief's minimal list. First-phase posts serialize `kind.discriminant: essay` plus title/date/excerpt/place/tags/standfirst/body, leaving optional layout fields to the site's defaults.

## Later phases

2. Story and book types; chapter/scene ordering; character/place cards, timeline/research, typewriter mode, daily goals and writing log, snapshots and comparison; Pandoc Markdown/PDF/DOCX/EPUB export. Acceptance: a finished story exported to PDF.
3. Selected-paragraph fact checks with verdicts and source links (or “your own record”), similar posts and the writer's angle, fiction consistency, chapter summaries, automatic local Git history. No automatic text rewriting.
4. One-way Notion idea import, writing log to Notion Habits, public README/screenshots/installer. Create the `Firextream/yazi` GitHub repository and push only with separate authorization.
5. Additional photo and reels rooms.

## Validation

File write/recovery/conflict/trash tests in Rust. Slug/frontmatter, isolated repository planning/commit/failure tests in Node. Real sharp/EXIF fixture for orientation, size, retained camera fields, removed GPS/serials and unchanged original. Pending desktop checks: keyboard flows, real close/autosave behavior, %125/%150 Windows scaling, dark/light layouts and NSIS installation/shortcut/size.

The two linked Claude artifacts were inaccessible during planning. Visual fidelity to those artifacts has not been claimed; the current layout follows the written screen and typography requirements.
