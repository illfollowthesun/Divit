# Yazı

A quiet Windows desktop app for writing. English interface, any writing language. Local Markdown and JSON, no account or cloud sync.

Warm paper, Newsreader, IBM Plex, a little rust. A writing desk, an idea board, and a place for images.

## Development

Requires Node.js 22.17+, Rust stable (MSVC), Microsoft C++ Build Tools with the Windows SDK, and WebView2. Install the prerequisites described in the [Tauri Windows guide](https://v2.tauri.app/start/prerequisites/#windows).

To inspect the interface without installing Rust, double-click **`preview.cmd`** from Windows Explorer. It installs the JavaScript packages in this project, checks the frontend build, and opens the browser when the development server is ready. Leave its console window open while using the preview. It needs a network-enabled normal Windows session for the initial package installation; the agent's restricted shell cannot do that download. This launcher is prepared but has not been run end to end here.

`node scripts/doctor.mjs` checks the browser prerequisites; `npm.cmd run doctor` also checks Rust and the Windows C++ tools. These checks do not install software or change settings. `run.cmd` and `build.cmd` display missing prerequisites rather than closing on an unexplained error.

```powershell
npm.cmd install
npm.cmd run desktop
```

For an isolated browser preview:

```powershell
npm.cmd run dev
```

The preview uses browser storage, clearly labelled in the interface. It cannot write to Documents or publish. Desktop data is not read or changed by the browser preview. Keep browser test images under 3 MB; desktop supports originals up to 100 MB.

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run test:ui
cargo test --manifest-path src-tauri/Cargo.toml
npm.cmd run package
```

The NSIS installer is written to `src-tauri/target/release/bundle/nsis/`. Its shortcut configuration uses Tauri's Windows installer defaults. Installer size and shortcut behavior still need verification on a built installer.

## Your writing

The desktop app resolves your actual Windows Documents folder (including redirected folders) and stores:

```text
Documents/Yazi/
  settings.json
  projects/<id>/project.json
  projects/<id>/draft.md
  ideas/<id>.json
  images/<id>/image.json
  images/<id>/original.<extension>
  _trash/<entry>/entry.json
  _trash/<entry>/content
```

Records have a `schemaVersion`. Project IDs are stable; changing the title or site address does not move the local draft. `draft.md` contains ordinary Markdown. Local images use `![caption](yazi-image:<id>)`; these references become site paths only during transfer. Writing metadata lives in `project.json`, without duplicating the body there.

Autosave serializes writes, drains edits made while saving, flushes before switching drafts and closing the desktop window, and checks the revision against disk before replacing content. The independently tested draft session blocks switching away from unsaved text after an error. Each project uses `.recovery.json` to finish an interrupted two-file save, and `.last-save.json` keeps the most recent full transaction. If recovery would replace different on-disk text, that version is first kept under the project's `.recovered/` folder. These are recovery records, not version history. A disk conflict keeps unsaved text in the editor and displays an error. Copy that text before reloading. A second desktop instance focuses the first one.

Archive and removal move records into `_trash`, with Restore in the UI. There is no permanent-delete action. Images referenced by writing cannot be moved to trash through the UI. Failed image imports remain under `.staging` and do not interrupt the library.

## Send to site

Set the local `modernist-portfolio` folder in Settings. Sending requires Node.js 22 and the site's installed dependencies. The app does not bundle Node or sharp, keeping the writing app small; the editor itself works without them.

1. Finish the title, date, text, address, excerpt and standfirst.
2. Choose **Send to site**, then **Check repository**.
3. Review the exact files and `post/<slug>` branch. Confirm with **Create local commit**.

The bridge requires a clean working tree, an unused branch and an unused post address. It checks the content-check command and image destinations before changing the branch, and repeats the repository checks after image preparation. Windows-reserved file names are rejected. The desktop command also checks that the on-disk draft revision matches the text reviewed in the editor. It writes Keystatic-compatible essay frontmatter and only the referenced images. It imports `scripts/lib/exif.mjs` directly from the site repository, without maintaining a second EXIF policy. Original images remain untouched; site JPEGs are oriented and resized to at most 2560 px with the site's camera-field allowlist, ICC profile preservation and post-processing privacy verification.

The bridge executes the site's `check:content` Node command directly, with the same arguments as `npm run check:content` and no shell interpolation. It checks that the package script still matches before proceeding. It commits only the listed files. Commit hooks are disabled for this content-only operation so a hook cannot stage or change unrelated files. Nothing is pushed.

After a successful commit the linked idea becomes Published. The site remains on the new local branch for review. If checking fails, files remain on that branch, no commit is made, and the idea stays a draft. Review or resolve that branch in Git before retrying. A draft already sent cannot be sent again in this first version; revisions to an existing site post are a later workflow.

## Keyboard

| Action | Shortcut |
|---|---|
| New writing | Ctrl+N |
| New story or book | Ctrl+Shift+N |
| Add chapter / scene | Ctrl+Alt+1 / Ctrl+Alt+2 |
| Character/place cards | Ctrl+Alt+K |
| Project notebook | Ctrl+Alt+N |
| Snapshots | Ctrl+Alt+V |
| Export story/book | Ctrl+Shift+E |
| Save now | Ctrl+S |
| Idea capture | Ctrl+Shift+I |
| Send to site | Ctrl+Shift+Enter |
| Focus mode | Ctrl+. |
| Settings | Ctrl+, |
| Help | F1 |
| Leave focus / close dialog | Esc |

All controls are reachable with Tab / Shift+Tab. Markdown undo/redo uses Ctrl+Z / Ctrl+Shift+Z. Native spellcheck is enabled; dedicated English/Turkish style suggestions are not implemented yet. Playwright browser tests cover persistence, idea-to-draft, archive/restore, focus/theme and preview sanitization; the complete browser suite passed using the installed Chrome during phase 2.

## Stories and books

Choose **New story or book** in the library. Blog posts keep their existing single-text/site workflow. Stories can use one text, scenes, or both. Books have an Opening and chapters with scenes. Every section has its own text and editor undo history.

- **Outline:** add chapters/scenes, rename the selected section above its text, drag to reorder or move a scene to another chapter. Up/down buttons provide keyboard-accessible ordering. **Set aside** preserves a section and its descendants; Restore brings them back.
- **Cards:** character/place cards with age, aliases, impressions and details. Set-aside cards remain recoverable within the project.
- **Notes:** research notes, a timeline with free-form event times, daily word goals and a local writing log. The log counts increases/decreases in manuscript word count; metadata and snapshot restoration do not earn writing credit. No AI or cloud service is involved.
- **Typewriter:** keeps the current line near the middle of the writing pane. Toggle with the toolbar or Ctrl+Alt+T. It works with Focus mode.
- **Start a rewrite:** keeps a snapshot of the selected chapter/scene (or the whole manuscript when Opening/Single text is selected) before returning to the editor. **Snapshots** compares a kept version with current text side by side. Restoring first preserves the current version as another snapshot. Kept versions cannot be edited or deleted through the app.
- **Export:** copies the whole manuscript in reading order; cards, notes and set-aside writing are excluded. Markdown can be downloaded without extra tools. Installed Pandoc enables DOCX/EPUB and normalized Markdown; PDF additionally needs Typst, XeLaTeX, LuaLaTeX, Tectonic or WeasyPrint on PATH. Typst requires Pandoc 3+. Each export uses a new filename and never overwrites an earlier copy.

In the desktop app, scene/chapter text lives in `projects/<id>/sections/<section-id>.md`. Cards and notes have their own JSON files. Snapshots keep immutable JSON plus readable Markdown under `snapshots/`. Set-aside parts move to `_trash/project-<id>/sections`, `cards`, or `notes`, and are restored from their project UI. Whole-project Trash still works as before. Desktop exports go to `Documents/Yazi/exports/`.

The development browser preview provides the same export dialog through a loopback-only local bridge, returning a browser download. It uses only that isolated preview's project data and images. The static production website build is not a browser-hosted app: use the desktop shell or the development preview for the local export bridge.

![Book outline and character cards](docs/screenshots/phase2-book.png)

[Snapshot comparison](docs/screenshots/phase2-snapshots.png) · [Typewriter](docs/screenshots/phase2-typewriter.png) · [Export](docs/screenshots/phase2-export.png) · [Compact layout](docs/screenshots/phase2-compact.png) · [Exported sample Markdown](docs/examples/the-last-ferry.md)

## Spell check

Each project has a LANGUAGE setting (English or Turkish), saved with the project. Yazı checks spelling itself with Hunspell dictionaries (en-GB and Turkish, both MIT-licensed, bundled with the app) running in a background worker, because the browser's own squiggles cannot be read or offered as suggestions. The Turkish dictionary loads in about a second the first time a Turkish project is open.

- Misspelled words get a red wavy underline. A word is checked only after you finish typing it. Links, code, HTML and images are skipped, and so are character and place card names and aliases.
- Click an underlined word to see up to three suggestions just above it. Click one to replace that word, or press Esc to close the popover.
- Right-click an underlined word (or press the context-menu key or Shift F10 on it) for the same suggestions, **Add to dictionary**, **Ignore in this project**, and Cut, Copy and Paste. Everywhere else the normal menu appears.
- The personal dictionary is stored per language in `Documents/Yazi/settings.json` (`dictionary.en`, `dictionary.tr`). Ignored words are stored in the project (`ignoredWords`).
- Nothing is ever corrected automatically. The native spellcheck and autocorrect are turned off.

## Research

Open **Research** in the project toolbar (Ctrl Alt R). It works without AI and makes no network call except fetching a page you paste.

- **Sources**: paste a link and Yazı keeps a readable copy (text only; images, embeds and link targets are dropped) that opens offline afterwards. Files dropped into the project's `research/inbox` folder are imported within a second or two; the toolbar shows how many are new. Search and filter by type and reading status (unread, read, quoted).
- **Search about this topic**: saves a request (topic, angle, language, number of sources) as a file and shows *Waiting for sources…*. **Copy request** puts a ready-to-paste prompt on the clipboard, with the inbox path and the source format. Ask Claude in chat; the sources it writes into the inbox appear in the list.
- **Reader and highlights**: select words in a source to highlight them in one of four colours or add a note. Highlights survive restarts; if the saved file is edited they follow their quote, and a quote that disappears is kept and marked, never dropped.
- **Highlights** and **Notes** tabs: every highlight with its note, and free notes for the topic that can link to a highlight. Research notes from the old Notebook tab were copied here; the originals stay in the project file.
- **Insert quote** (from a highlight or a selection) adds the quote at the cursor with its citation, as a quote block or a footnote, and asks first above 50 words. The source is then marked as quoted, with where it was used.
- **Export** can end with a *Sources* list of the sources actually quoted, in the order they were first used.

### Research files

Each project keeps its research next to the writing, as plain files that stay readable without Yazı:

```
Documents/Yazi/projects/<project-id>/research/
  research.json        index: sources (status, where each was quoted), highlights, notes, AI notes, requests
  sources/<id>.md      one saved source: frontmatter + the readable text
  inbox/               drop source files here; Yazı imports them (imported originals move to inbox/_imported)
  requests/<id>.md     "Search about this topic" requests
```

A source file (the same format in `inbox/` and `sources/`):

```
---
title: ...
url: https://...
site: ...
author: ...
published: 2026-10-20
saved: 2026-10-29
type: news | article | blog | paper | other
topic: <the topic it was searched for>
summary: 2-3 sentence summary
---

Readable text (Markdown). Keep the original wording; never paraphrase silently.
```

Only `title` is required. Values containing `: `, `#` or quotes are written as double-quoted strings. Sources are deduplicated by URL (ignoring `www.`, tracking parameters, `#fragments` and trailing slashes). Highlights, notes and AI notes live in `research.json`, never in the source text or the manuscript. Saved sources are for the writer's private research; quotes inserted into the text always carry their citation.

## Automatic backups and manual restore

In the desktop app, open Settings and choose a backup folder outside `Documents/Yazi`, such as a USB drive or a folder already managed by OneDrive. Save settings to enable the daily check, or use **Back up now**. Backups run once per local day while the app is open, and again on close after writing has been saved. They use the installed Node.js 22 runtime. The native storage lock serializes the full ZIP against application writes. Settings shows the last successful backup time; a failed backup does not replace that record.

The newest 14 app-owned ZIPs remain in the selected folder. Older copies move to its `_trash` subfolder, preserving the app's never-delete rule; this does not reclaim their disk space. Unrelated ZIP files are untouched. Archives include the full Yazi folder, including ideas, projects, images, snapshots, recovery files and trash. Unicode filenames/content use standard UTF-8 ZIP entries. Archives over 4 GB or 65535 entries are rejected without replacing an earlier backup. If the backup drive is unavailable on close, writing is saved first and you can reconnect it or explicitly close without a new backup.

To restore:

1. Close Yazı. Copy the current `Documents/Yazi` folder to a separate safe location first.
2. Extract the selected ZIP into a **new, empty folder** using Windows Extract All. It contains a `Yazi` folder.
3. Inspect its Markdown/JSON files, images and snapshots before using them. Keep the current and extracted copies separate until verified.
4. With Yazı closed, rename the current data folder to a dated recovery name, then copy the extracted `Yazi` folder into Documents. Do not merge or overwrite the current copy automatically.
5. Reopen Yazı and verify the library and backup destination in Settings. Keep the displaced data folder until you have checked everything.

The browser preview cannot select or back up the desktop Documents folder. ZIP construction, independent Windows ZIP extraction, daily skipping, forced close copies and 14-copy rotation are tested with disposable fixtures. Native Tauri scheduling/close integration still requires Rust/WebView2 runtime verification.

## Status

Phase 1, phase 2 and the phase 2 polish (docs/POLISH_phase2.md, items 1–8) are implemented. The production frontend build, 40 Node tests and 24 browser tests pass. The screenshots and sample Markdown above come from actual browser-preview interactions in an isolated test profile.

Phase 2 polish, before → after: [1440 before](docs/screenshots/polish-before-1440.png) · [1440 after](docs/screenshots/polish-after-1440.png) · [960 before](docs/screenshots/polish-before-960.png) · [960 after](docs/screenshots/polish-after-960.png) · [Snapshot diff](docs/screenshots/polish-after-snapshots.png) · [Typewriter](docs/screenshots/polish-after-typewriter.png) · [Export](docs/screenshots/polish-after-export.png)

Not yet verified on the desktop runtime: the Rust side (backup command, window-close permissions) has not been compiled on the current machine, which lacks the Visual Studio C++ build tools. Check backups, closing the window and spelling in `npm run desktop` before relying on them.

Rust/MSVC and Pandoc/PDF engines are not installed in the agent environment. Native storage tests and Windows packaging remain unexecuted. Real DOCX/EPUB/PDF rendering remains unverified; process-contract tests are explicitly distinguished from rendering tests. The browser preview's real Markdown download works. See [verification](docs/verification.md). Phase 2's acceptance milestone still requires Emir to finish a story and export a PDF with the actual tools.

The main `.git` directory is read-only in this session. Separate commits for each feature are preserved in the copied local repository `.tools/phase2-history`, with a portable `.tools/yazi-phase2.bundle`. No commits were written into the protected main `.git`, and nothing was pushed. See [portable history](docs/phase2-history.md).

MIT. Font packages include their own open font licenses.
