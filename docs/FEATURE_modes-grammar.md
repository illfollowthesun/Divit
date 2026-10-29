# Yazı — Writing modes and grammar check

## Idea
Two additions, both requested by the writer:
1. A grammar and spelling check in the spirit of Grammarly: underlines in the text, a short suggestion on click, one-key accept or ignore.
2. Modes, so checking never interrupts writing. Three modes, switched from one small control and a shortcut:
   - **Write**: only the text. No panels, no underlines, no counters, no research drawer, no AI. Cursor line can stay centred (typewriter scroll, optional).
   - **Review**: the text plus underlines (spelling, grammar, style), a list of issues in a side panel, accept / ignore / ignore always. Read-only feel is fine but typing must still work.
   - **Normal**: today's app with everything available. Underlines appear only when the user turns them on here.

## Design decisions (already made)
- Checking never runs in Write mode. Switching to Review triggers a check of the whole document; Normal checks only if the user enabled it.
- Mode is remembered per document and globally (last used), and shown quietly (one word, no banner).
- Shortcuts: Ctrl+1 Write, Ctrl+2 Review, Ctrl+3 Normal; Esc leaves Write mode to Normal.
- Languages: Turkish and English at least, detected per paragraph; user can force a language per document.
- Engines, in this order (behind one `Checker` interface with capability flags, same style as the AI providers):
  1. **Local spelling**: already exists (Hunspell en-GB + Turkish in a background worker, see README). Reuse it as the first engine; do not rebuild it. Offline, always available.
  2. **LanguageTool**: optional, either the public API or a self-hosted local server URL set in Settings. Check first whether it supports Turkish; if not, use it only for English.
  3. **AI review**: uses the already configured AI provider for grammar and style, only on demand ("Check with AI" button in Review), returns structured issues (range, type, message, replacement). Output is clearly labelled as AI.
- Personal dictionary: "add to dictionary" stored locally and respected by all engines.
- Issue ranges must survive edits (re-anchor like research highlights in `src/research/anchor.ts`); stale issues disappear rather than point at wrong text.
- Underline colours: spelling red, grammar blue, style muted; calm, thin, same look as the rest of the app.
- No network call without the user enabling that engine. Keys stay in the OS keychain as with AI.

## Acceptance
- Write mode hides everything except the text, and nothing runs in the background that could change the screen.
- Review mode underlines a Turkish and an English sample correctly with local spelling alone (no network).
- Accept replaces exactly the flagged range; Undo restores it; ignore-always persists after restart.
- Switching modes never loses cursor position or scroll.
- Tests for anchoring of issues after edits, and a UI test for each mode.

## Order of work
1. Modes (Write / Review / Normal) with shortcuts and persistence — no checking yet.
2. Checker interface wrapping the existing Hunspell spelling + Review-mode issue panel (reuse current underlines).
3. Personal dictionary and ignore rules.
4. LanguageTool engine (optional setting).
5. AI review on demand.
Plan first, show the plan, then build step by step with a commit after each step.

## Implementation progress
- Step 1: Write / Review / Normal selector and shortcuts, Escape to Normal, per-project and last-used persistence. Mode saves preserve the writing timestamp. Normal underlines default off and require explicit opt-in. Write hides the surrounding UI, removes spelling, pauses research polling and ignores late spelling results. The editor stays mounted across mode changes.
- Step 2: a capability-based `Checker` interface wraps the existing Hunspell en-GB + Turkish worker. Review checks the whole active text (including offscreen paragraphs), shows a local spelling issue panel, and supports exact replacements with Undo. Paragraph language detection uses a small local heuristic; ambiguous paragraphs default to English, and the document can force English or Turkish. Existing dictionaries, suggestions, Markdown exclusions and card-name acceptance are reused. No grammar/style engine or external checking requests yet.
- Step 3: Review offers Ignore once (one occurrence until the active text is closed), Ignore always (a language-specific word in this project, saved across restart), and the existing per-language personal dictionary (all projects). Legacy project ignored words and accepted card names remain supported. Shared ignore rules can also identify grammar/style rules for future engines. Issue ranges and ignore-once anchors map through CodeMirror transactions; edits inside a flagged token discard it, and stale panel actions cannot replace another occurrence of the same word. Mode switches retain the editor, undo history, caret, scroll and temporary ignores.
- Steps 4–5 are deferred until research step 7 is complete.

### Verification of steps 1–3
- Unit coverage: mode fallback and opt-in, metadata saves, paragraph language selection and whole-text scanning, exact range mapping with Turkish/emoji offsets, repeated-word safety, and word/rule ignore scope.
- Browser coverage: all three modes, persistent opt-in, whole-text mixed EN/TR Review without external requests, exact replacement/Undo, dictionary and ignore persistence/scope, and long-text caret/scroll preservation. Existing spelling tests explicitly enable underlines; writing, projects, research inbox/quotes and AI Settings checks remain compatible.
- Local spelling is the only enabled checker in this work. Language detection is heuristic; use the document language override for ambiguous or short paragraphs.
