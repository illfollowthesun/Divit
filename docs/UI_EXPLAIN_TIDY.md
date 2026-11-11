# UI explain and tidy (after ui/focus-companion)

Branch: `ui/focus-companion`. The working tree already holds uncommitted work (Typewriter no longer hides the
bars, the companion toggle with Ctrl+Alt+P, Focus tidy-up, `tests/ui/companion.spec.ts`). Do not rewrite it.
First commit it as its own commit ("ui: Focus, Typewriter and the companion each do one thing"), then do the
items below in small commits. Do not push, do not release, do not merge into main.

Screens were reviewed at 1440x900 and 1000x760, English and Turkish, in the browser preview.

## A. Fix first

1. The selected chapter/scene is not remembered. In a book, select "Chapter 2 / Scene 1", save, reload: the
   editor shows the empty "Opening". Remember the last section per project (the project file already saves
   `mode`; a `lastSectionId` beside it is fine) and restore it when the project opens. Fall back to the first
   non-trashed section if it no longer exists. One reviewer run also landed on "Opening" after walking the
   Settings tabs (Your files / AI / About) and closing; check whether anything there re-selects the project.
2. The library overflows. With a book outline at 900 px height "Trash" is cut off and "Keyboard shortcuts" is
   off screen. The bottom block (Trash, Keyboard shortcuts) must always stay visible; the outline and the
   document list share the space above it and scroll on their own.
3. Markdown headings in the editor look like links: `## A heading` is underlined (CodeMirror's default
   highlight style) and body-sized. Give headings their own style: no underline, larger serif (h1 > h2 > h3),
   the `##` marks in the muted colour. Emphasis markers (`*`) in the muted colour as well.

## B. Explanations

4. Three ways to quieten the screen and none explains itself: the Normal / Write / Review select, Focus and
   Typewriter. "Write" is also the name of the top tab.
   - Tooltips say what happens, then the shortcut, for example:
     Focus: "Hide the library and the bars; move the mouse to the top to bring them back (Ctrl+.)".
     Typewriter: "Keep the line you are writing at the same height (Ctrl+Alt+T)".
     Mode options: Normal "everything", Write "only the text, Esc to leave", Review "spelling underlines and
     the issue list".
   - Put a visible "Mode" label before the select (muted, same size as the toolbar text).
5. "Companion" does not say what it is. Rename the visible button and tooltip to "Side panel"
   ("Side panel: preview, cards, notebook (Ctrl+Alt+P)"); Turkish "Yan panel". Keep ids, class names and the
   aria-label "Writing companion" / "Toggle companion" unless tests are updated with them.
6. The outline has unexplained signs: the grey status dot on scenes, the word counts beside chapters, the up
   and down arrows and "Set aside". Add title/aria-label text for each ("Status: draft", "64 words in this
   chapter", "Move up", "Move down", "Set aside: moves this scene to the trash, it can be restored").
7. The summary line under the title shows the placeholder as if it were a value:
   "Somewhere - 11 Nov 2026 - Language: auto - + tags". When place is empty show "+ place" in the same style
   as "+ tags".
8. The More menu: "Underlines", "Start a rewrite" and "Archive" do not say what they do, and "Archive"
   actually moves the project to the trash. Add a one-line hint under each item (the Menu component already
   has `hint` for shortcuts; add a description line) and rename "Archive" to "Move to trash".
9. The welcome card only explains the three modes. Add one short row: Focus, Typewriter, the side panel and
   Research, each with its shortcut. Keep the card the same size class (no scrolling at 900 px height).

## C. Tidy

10. The Notebook shows "Research notes now live in the Research panel Ctrl Alt R." permanently and it wraps
    badly. Show it once, with a dismiss button, and remember the dismissal.
11. Turkish interface: the mode select is drawn as a bordered box while English is flat; make both flat.
    The trash is called "Kenara konanlar", which collides with "Set aside" for scenes. Use "Çöp kutusu"
    (with the proper Turkish letters) for the trash room and keep "Kenara koy" for scenes.
12. The shortcut sheet is a flat list of 20 rows. Group it under three small headings: Writing, Project, View.

## Leave alone (owner decides later)

- The Reflection tab, the Preview tab as the default, and the decorative numbers ("YOUR DESK 01",
  "02 / IDEA BOX", "01-04" on the idea columns).

## Rules

- Every new or changed string gets a Turkish translation in `src/i18n/tr.ts`; `npm test` checks this.
- Calm look stays: no new colours, no icons where text does the job.
- Tests: update the specs that name changed labels; add a UI test for items 1, 2, 3 and 7.
  `tests/ui/updates.spec.ts` already fails on main (two `plugin:updater|check` calls); do not chase it here,
  just report it.
- Run UI tests on their own port so they do not collide with a running app:
  PowerShell `$env:YAZI_UI_PORT=1437; $env:YAZI_UI_WORKERS=2; npx playwright test`.

## Done when

`npx tsc -b`, `npm test` and the Playwright suite pass (apart from updates.spec), before/after screenshots at
1440 and 1000 wide are in `docs/screenshots/explain-*.png`, and everything is committed on
`ui/focus-companion`. End with a short summary of what changed and anything you decided differently.