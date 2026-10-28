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
| Save now | Ctrl+S |
| Idea capture | Ctrl+Shift+I |
| Send to site | Ctrl+Shift+Enter |
| Focus mode | Ctrl+. |
| Settings | Ctrl+, |
| Help | F1 |
| Leave focus / close dialog | Esc |

All controls are reachable with Tab / Shift+Tab. Markdown undo/redo uses Ctrl+Z / Ctrl+Shift+Z. Native spellcheck is enabled; dedicated English/Turkish style suggestions are not implemented yet. Playwright browser tests cover persistence, idea-to-draft, archive/restore, focus/theme and preview sanitization; these still need execution after installing packages and a Playwright browser.

## Status

Phase 1 source is implemented: editor, preview, autosave, focus, idea board, image library, trash/restore, settings, and local site transfer. Story/book tools, AI checks, exports, automatic Git history and Notion are later phases.

At the initial implementation checkpoint, the publishing tests pass, including real sharp + site EXIF integration. Full dependency installation, React production build, Rust tests, Windows packaging and visual/scaling checks remain unverified: the development environment has no Rust/C++ toolchain and denies network downloads. See [verification](docs/verification.md). The phase-1 acceptance milestone still requires writing a real post end to end in the built desktop app.

MIT. Font packages include their own open font licenses.
