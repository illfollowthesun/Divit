# Layout pass: one right dock, sorted rows, Research and Export tidy

Branch: `ui/focus-companion` (clean, four commits ahead of main). Work on top of it in small commits.
Do not push, release or merge into main. Read `docs/UI_EXPLAIN_TIDY.md` for what the last pass did.

## Why

The owner's verdict after trying the build: the right side and the two top rows do not make sense yet.

- Two different things live on the right and are opened from two different rows: the side panel (text button in
  the top bar) and Research (a separate drawer opened from the project toolbar, which replaces the panel).
- The rows mix levels. The top bar holds app navigation and three view toggles; the project toolbar holds the
  mode select, a panel opener (Research) and actions (Export, More). The save state sits alone at the far end of
  the bottom row.
- Research and Export look assembled rather than designed.

Three concepts were weighed:

- A. One dock on the right. Research becomes a tab of the same panel; rows are sorted by level; panels are
  toggled by small panel icons at the two ends of the project row. Chosen: smallest change that removes the
  split, keeps every feature, keeps writing and sources side by side.
- B. Research as its own room next to Write and Idea box (full width reader). Rejected: you could no longer read
  a source while writing, which is the point of the feature.
- C. A single top row plus a command palette. Rejected: hides too much for a calm, self-explaining app.

## Target layout (concept A)

```
+----------------------------------------------------------------------------------------------+
| Divit   A little room...            Write   Idea box 2                              Settings |   app row
+----------------+---------------------------------------------------------+-------------------+
| YOUR DESK      | [lib] BOOK / Draft . Saved     Mode v  Typewriter  Focus | Export  More [dock] |   project row
| ...            |                                                         | Preview Cards Notebook Research Images
| MANUSCRIPT     |   Title                                                 |                   |
| ...            |   text                                                  |   dock content    |
| Trash / Keys   | 149 words . 1 min read . goal                           |                   |   count row
+----------------+---------------------------------------------------------+-------------------+
```

### 1. Rows

- App row: brand, tagline, the room tabs (Write, Idea box), Settings. Nothing else.
- Project row (only in the Write room with a project open), left to right:
  - a library toggle icon (see 2), then the status "BOOK / Draft" followed by the save state
    ("Saved", "Saving...", "Unsaved changes", errors in the error colour). The save state leaves the bottom row.
  - a "view" group: Mode select (with its label), Typewriter, Focus. Same toggle look as today
    (`aria-pressed`), a little space separates the group from the next.
  - an "actions" group: Export, More.
  - the dock toggle icon at the far right.
- Bottom row: word count, reading time, daily goal. Thinner (about 34 px). In Focus it hides with the bars and
  returns with them.
- Without a project (welcome / blank desk) the project row is not shown, as today.
- Focus still hides the app row and the project row and brings them back at the top edge. Because the Focus and
  Typewriter buttons now live in the project row, check the reveal still works and that Esc order is unchanged.

### 2. Panel toggles are icons

- Replace the "Side panel" text button with a small inline SVG icon: a window outline whose right pane is
  filled when the dock is shown. Mirror icon at the left end of the project row for the library (left pane
  filled when shown). 32 px hit target, `aria-pressed`, tooltip with the shortcut
  ("Side panel: preview, cards, notebook, research (Ctrl+Alt+P)", "Library (Ctrl+Alt+L)").
- The library becomes hideable at every width like the dock: same remembered-state pattern as
  `divit-companion` (key `divit-library`), shortcut Ctrl+Alt+L, the text column keeps the 760 px measure when a
  panel is hidden. In narrow windows the existing edge tabs and drawers stay as they are.
- These are the only two icons. Do not add icons elsewhere.

### 3. One dock: Research is a tab

- Dock tabs: Preview, Cards, Notebook, Research, Images (story/book); Preview, Research, Images (blog).
  Remove the Reflection tab and its strings.
- Research content moves from `ResearchDrawer` into the dock as the Research tab. Delete the separate drawer,
  its close button and the `research-open` class; keep all behaviour (sources, reader, highlights, notes, quote
  insertion, AI search, inbox count).
- The dock is 340 px for the other tabs and 440 px while Research is the active tab (animate the width unless
  reduced motion). Text column never narrower than 560 px: below about 1240 px the Research tab uses the
  existing drawer presentation.
- Ctrl+Alt+R shows the dock on the Research tab; pressed again while Research is showing it returns to the
  previous tab. The "n new" inbox count moves to the Research tab label. The Research button leaves the project
  row.
- Remember the last dock tab per project type in the same local storage pattern.
- Review mode keeps replacing the dock with the issue list, as today.

### 4. Research tab tidy

- No "RESEARCH 1 x" header; the tab is the header. Sub-views Sources / Highlights / Notes become one segmented
  control directly under the tabs.
- One input row: "Paste a link, or type a topic" plus one button whose label follows the input
  ("Save" for a link, "Search" for a topic). Remove the separate full-width "Search about this topic" button;
  offer it as a text link under the input ("Search about: <section title>") when the input is empty.
- The filter row (find, type, status) appears only when there are more than five sources, behind a "Filter"
  text toggle.
- Status messages ("Saved a readable copy: ...") show as a quiet line at the bottom of the tab for a few
  seconds; they must not push the content down.
- Source rows: title in serif, one meta line (site, date, type chip, unread dot). Empty state: one sentence and
  the input, nothing else.

### 5. Export dialog tidy

- Title stays. Under it one line saying what will be exported ("The Last Ferry - 5 chapters and scenes"),
  not a large grey card.
- Formats as a short list of radio rows instead of a native select: name on the left ("Word", "PDF",
  "Markdown", whatever exists today), one line of plain description under each ("Made by Divit itself", or the
  tool it needs). The note that today sits under the select moves into these rows.
- The "Add a Sources list" checkbox aligns with the rows and is disabled with its reason when nothing is quoted.
- One primary button; after export show the file name and "Show in folder" in place of the button row.
- Keep every existing option and behaviour; this is layout only.

### 6. Left over from review

- Outline: keep the "MANUSCRIPT" heading fixed while the list scrolls (it scrolls away in short windows).
- Shortcut sheet: the last row is cut off at 900 px height; make the list area scroll cleanly with a little
  bottom padding. Add the new Ctrl+Alt+L row.
- Welcome card and README shortcut table: update for the icon toggles, the Research tab and Ctrl+Alt+L.

## Rules

- Every new or changed string gets a Turkish translation; `npm test` checks this.
- Calm look stays: existing colours and fonts only.
- Update the specs that the move breaks (research-*.spec.ts open Research through the toolbar button; give
  them one helper that opens the Research tab). Add tests for: Research as a dock tab and Ctrl+Alt+R toggling
  back; library hide/show remembered; save state in the project row; export format rows.
- `tests/ui/updates.spec.ts` fails on main already; `modes.spec.ts` can be flaky under load. Report, do not
  chase.
- UI tests on their own port: PowerShell `$env:YAZI_UI_PORT=1437; $env:YAZI_UI_WORKERS=2; npx playwright test`.

## Done when

`npx tsc -b`, `npm test` and the Playwright suite pass (apart from updates.spec); before/after screenshots at
1440x900 and 1000x760, English and Turkish, of the desk, the Research tab with one source, the export dialog
and Focus with the bars revealed are in `docs/screenshots/layout-*.png`; everything is committed on
`ui/focus-companion`. End with a short summary and anything you decided differently and why.