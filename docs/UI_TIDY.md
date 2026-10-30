# UI tidy-up (0.1.0-beta.2)

Goal: same features, less on screen. Nothing new is added; nothing is removed that a user cannot still reach in one or two clicks. Write mode stays as it is.

Rules for both agents
- Work on your own branch (Claude Code: `ui/shell`, Codex: `ui/panels`). Only touch the files of your part. If you need a change in the other part, write it under "Requests" at the end of this file instead.
- Keep EN and TR strings in `src/i18n` in step. Keep WCAG AA contrast. Click targets at least 32 px high on desktop (44 px is the tablet goal, see TABLET_NOTES.md).
- No hover-only actions. Every shortcut keeps a visible control.
- Run `npm test`, `cargo test` and `npm run test:ui` before every commit. Update UI tests that check removed text; do not delete tests to make them pass.
- Before and after screenshots at 1440×900 and 960×700 in `docs/screenshots/tidy-before-*` / `tidy-after-*`, using the invented sample text only.
- Do not push, tag or release.

## Part A — Claude Code: shell and layout (`ui/shell`)
Files: App.tsx, editor toolbar, sidebar, research drawer container, status bar, layout CSS.
1. Document toolbar is too long (mode menu, Underlines, Research, Archive, Export, Snapshots, Start a rewrite) and gets cut off when the drawer is open ("Snapsho…"). Keep visible: mode menu, Research, Export. Move Archive, Snapshots, Start a rewrite and Underlines into one "More" (…) menu. It must never overflow at 960 px.
2. Research drawer currently covers the text and clips the LANGUAGE field. Make it push the editor (editor column shrinks, text re-wraps), or overlay only below 1100 px with a visible close button.
3. Decorative copy appears four times ("A little room for your words.", "MAKE A LITTLE SPACE. WRITE.", "LOCAL FILES. YOUR WORDS.", "Take your time. It's your page."). Keep only the header tagline; remove the other three.
4. Metadata row (Place, Date, Tags, Language) sits between title and text. Collapse it into one quiet line under the title (e.g. "Somewhere · 30 Oct 2026 · English · + tags") that opens the fields on click.
5. Sidebar: put "Find a piece…" at the top under "New writing". Merge "New story or book →" and "Bring in writing…" into the New writing button as a small split/dropdown. Keep the counts.
6. Status bar: remove the "Focus mode Ctrl ." hint (it is in the shortcut sheet); keep word count, read time, save state.
7. Top bar: Write / Idea box in the centre and Typewriter / Focus / Settings on the right is fine; make the active state and spacing consistent with the toolbar.

## Part B — Codex: panels and Settings (`ui/panels`)
Files: settings/*, review/check panel (spell), right panel tabs, research drawer contents.
1. Settings modal: one long scroll, its top is cut off and the Save button is out of view and greyed. Split into side tabs (General, Writing, Appearance, Your files, AI, About). Sticky footer with Save / Cancel always visible; Save enabled as soon as something changes.
2. AI section text is dense. Keep one short sentence per field; move pricing and privacy details behind a "Details" disclosure. Model list: show the name, put prices in the disclosure.
3. Review panel spelling cards repeat the word three times ("raileing / Check spelling: raileing / Local spelling · English (UK) / railing"). Show: the word, the suggestion(s) as buttons, then Ignore once / Ignore always / Add to dictionary in a small row. Language line once at the top of the panel, not per card.
4. Right panel tabs (Preview, Cards, Notes, Check, Images): "Check" overlaps with Review mode and "Notes" with research notes. Rename or merge so each idea has one place; explain the choice in the commit message.
5. Small mono caps labels (10–11 px, light grey) are hard to read. Raise to at least 12 px and AA contrast in all seven themes.
6. Research drawer contents: source URL line, quote box and body repeat the same first sentence; show title, source line, then the text, with highlights.

## Merge
When both parts are done, Claude Code merges `ui/panels` into `ui/shell`, resolves conflicts, runs all tests, takes the after screenshots and lists anything left over. Then the writer decides on 0.1.0-beta.2.

## Requests
(add cross-part requests here)
