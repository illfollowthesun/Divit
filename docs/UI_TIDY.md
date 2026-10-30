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

- B1 / App.tsx: the settings form is inline in this Part A file. Import `SettingsForm` from `./settings/SettingsForm` and replace the inline form with it inside the existing Modal. Pass `panels` with General = interface language + update controls, Writing = daily goal + advanced publishing, Appearance = theme picker, Your files = BackupSettings + LibraryLocation, AI = AiSettings, About = existing version/privacy text. Pass `dirty={JSON.stringify(settings) !== JSON.stringify(lib.settings)}`, `busy`, the existing save handler as `save`, and `cancel={() => setDialog(null)}`. Keep AI's existing independent save/key controls. The component keeps drafts mounted, supports arrow/Home/End tab navigation and contains scrolling above a persistent Save / Cancel footer. Its CSS scopes modal containment to `dialog:has(.settings-form)`.
- B4 / App.tsx: retain tab state keys and shortcuts, but display `t('Reflection')` for Check and `t('Notebook')` for Notes. Check contains reflection prompts, not spelling controls; Notebook contains project notes and the writing log, while source-linked notes remain in Research. Both EN and TR labels are supplied. Update the existing companion-tab text assertions when wiring these labels. No feature is removed or merged.
- B5 / shell CSS: this branch raises labels in panel and settings contents only. Please raise remaining shell labels to 12 px and retain theme text tokens; shell layout CSS is outside this branch's scope. There are six explicit palettes plus Match Windows (the seventh choice resolves to light/dark).

## Merge status (Claude Code, ui/shell)
- `ui/panels` (5404fc5, c476f2a) merged into `ui/shell` without conflicts.
- Requests done: B1 `SettingsForm` wired into the Settings modal (General, Writing, Appearance, Your files, AI, About; Save/Cancel always visible, Save on when something changed; themes still apply and save at once). B4 companion tabs read Reflection and Notebook (keys and shortcuts unchanged). B5 remaining shell labels at 12 px with theme colour tokens.
- After screenshots: `tidy-after-shell-*` (desk, desk-tr, research, settings, review at 1440 and 960) and refreshed `tidy-after-panels-*` from the merged app. README screenshots refreshed (no dot after Divit).

### Left over
- Labels under 12 px still exist in places neither part owned: character cards (`.project-card>small` 8 px), the snapshot comparison headers (8 px), notebook tab buttons and export result lines (10 px), the Publish to my site checklist (11 px).
- The Settings title ("Make yourself at home", 32 px) takes room at 960×700; a shorter heading would give the tabs more height.
- Only the browser preview was checked; the desktop build was not rebuilt or run for this branch.
