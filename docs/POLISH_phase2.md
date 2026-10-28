# Yazı — review after Phase 2 (brief for Codex, 29 Oct 2026)

Talk to Emir in Turkish, short. Plan first, wait for "ok". Based on docs/screenshots/phase2-*.png.

## 0. First: commit (blocker)
The repo has NO commits ("main does not have any commits yet"). Before any change: commit the current state in logical commits (phase 1 core, then each phase-2 feature) so nothing can be lost. The .git folder is owned by the Codex sandbox user, so Emir's own git says "dubious ownership" — fix ownership or tell Emir the exact one-line command. Don't commit .tmp/ or .tools/ (add to .gitignore).

## 1. Quieter chrome
- Export is the loudest thing on screen (filled rust button) though it's rare. Make Export/Archive/Snapshots/Start a rewrite one quiet text toolbar; filled rust only for the primary action inside dialogs (Keep snapshot, Export manuscript).
- Typewriter and Focus: hide the project toolbar too (show it on mouse move to the top, like the header). Typewriter currently leaves a big empty band above the first line — keep the caret line at ~45 % height but start the scene heading right above the text, not floating.

## 2. Cards (right panel)
- Card fields are set in the large body serif with wide gaps (looks like the manuscript). Use the UI font at 14 px for field text, serif only for the name; tighter spacing; show 3–4 fields before "more".
- Clicking a name in the text opens its card (if not already) — check it works for names with Turkish letters (Derya, Çağla, İlker).

## 3. Snapshots
- Compare view shows raw Markdown ("## 06:10 · Karaköy"). Render headings like the editor.
- Highlight what changed (word-level diff: removed = soft red strike, added = soft green), with "only show changes" toggle. Without highlights the two columns are hard to compare.

## 4. Manuscript tree
- Chapter/scene rows are tiny (≈11 px, CH/SC tags, ↑ ↓ buttons). Rows 13 px, 32 px hit target, drag handle on hover, word count per chapter on the right, scene status dot (draft / to fix / done).

## 5. Narrow windows (≤ 1100 px, see phase2-compact.png)
- The meta row (Place/Date/Tags) is cut off at the top and the right panel squeezes the text. Below 1100 px collapse the right panel into a drawer (button on the edge); below 900 px collapse the left sidebar too. Text column never narrower than 560 px.

## 6. Small things
- Date field: use the same text style as Place/Tags (no native calendar icon floating far right), ISO 2026-10-29 or the OS locale, consistently.
- "Today 203 / 500" goal: a thin progress line is enough; keep it.
- Footer "Focus mode Ctrl ." → show the shortcut as a key chip like Ctrl N in the sidebar.

## Done when
Before/after screenshots at 1440 and 960 wide, tests + Playwright pass, everything committed. Ask before creating/pushing the GitHub repo.

## 7. Two additions (Emir, 29 Oct)
- Automatic backup: once a day (and on app close) zip Documents\Yazi into a backup folder Emir picks (e.g. OneDrive or USB), keep the last 14 zips, show "Last backup: today 01:12" in Settings. Restore = unzip guide in README, never automatic overwrite.
- Spell check in the editor for English and Turkish (WebView2 spellcheck via CodeMirror contentAttributes spellcheck=true; language follows project setting). Squiggles only, no auto-correct.
