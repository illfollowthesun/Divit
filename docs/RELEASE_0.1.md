# Yazı — finish, polish and publish 0.1.0-beta.1

Work in this order. Commit after each part, no push until the writer says so.

## A. Finish open features
1. **Sources box UX.** If the text in the Sources box is not a URL, do not treat it as one. Show "Search this with AI" (AI on) or "Turn on AI in Settings to search" (AI off) and prefill the search form with the text.
2. **Clear provider errors.** Gemini 429 "exceeded your current quota": say the key's free tier probably has no Google Search grounding quota; offer enable billing / switch provider / "Ask without web search" (no grounding, labelled unsourced). Gemini 402: say billing on the key's Google project is not active yet and link to AI Studio billing. Keep the per-minute retry message for real rate limits.
3. **Search without a paid AI.** SearchProvider setting: Tavily (key, free tier), Brave Search (key), self-hosted SearXNG (URL). When the AI has no native search (local Ollama/LM Studio, or Gemini without grounding quota), fetch results there, then let the selected model rank and summarise them into the same candidate list. Clearly labelled. Keys in Credential Manager.
4. Decide what to do with the uncommitted `docs/examples/the-last-ferry.md` and five `docs/screenshots/polish-after-*.png`: if they are stale outputs of an old polish run, restore them; if they are newer, commit them. Say which.

## A2. Also in this round (decided by the writer)
5. **Auto-update** with the Tauri updater against GitHub releases (signed update manifest; key kept out of git). Check on launch, ask before installing.
6. **Feedback:** "Send feedback / Report a bug" in Help, opening GitHub issue templates (feedback, bug) like Ayikla's; include app version and OS, never document text.
7. **Import:** bring in existing .md and .docx files (one file or a folder) as a new project or into an existing one. Never move or change the originals.
8. **Turkish interface:** move all UI strings into an i18n layer (en, tr); language picker in Settings, default from Windows. Writing language stays separate.
9. **Writing goal and streak:** optional daily word goal and a days-in-a-row count built on the existing writing log; quiet, hidden in Write mode, off by default.

## A3. Fit for general users (found in review)
10. **"Send to site" is Emir-specific.** Default `siteRepo` points at his duruduygu.com repo. For a public build: hide Send to site unless a site repository is set, rename it "Publish to my site (advanced)", no personal path as default, and keep Emir's setup working.
11. **Export needs Pandoc.** Most users don't have it. Add built-in DOCX and PDF export that works with no extra tools (keep Pandoc/Typst as an optional higher-quality path), and say clearly which path was used.
12. **Stale text and settings:** remove "AI checks will arrive in phase 3, using Claude Code by default." and migrate the old `aiProvider` field ('claude-code' | 'anthropic' | 'ollama') to the new AI settings without losing data.
13. **Data folder choice:** keep Documents\Yazi as default but let the user pick another folder (for example inside OneDrive or Dropbox), with a safe move and a warning about two computers editing at once.

## B. Polish (calm, no new features)
- One pass over every screen at 100 / 125 / 150 % scaling: spacing, alignment, cut-off text, focus rings, empty states, error states, dark corners.
- Write mode must show nothing but the text. Review and Normal must not jump layout when underlines appear.
- Consistent wording: sentence case, no jargon ("grounding" never shown to users), every error says what to do next.
- Keyboard: every action reachable, shortcuts listed in one Help/Shortcuts sheet.
- First launch: a short welcome that explains projects, the three modes and that nothing leaves the computer unless AI is turned on.
- Take fresh screenshots for the README (Write mode, Review with underlines, Research drawer with a saved source, Settings → AI). Use invented sample text only.

## C. Release
- Version 0.1.0-beta.1 in package.json, Cargo.toml and tauri.conf.json.
- `npm test`, `npm run test:ui`, `cargo test`, then `tauri build` producing the NSIS installer (and MSI if it builds). Note the installer is unsigned.
- README for users first: what Yazı is, screenshots, download, first steps, modes, research, AI (providers, costs, keys stay in Windows Credential Manager, free options), privacy, keyboard, build from source, licence (MIT). Developer details further down.
- `docs/releases/v0.1.0-beta.1.md`: short release notes.
- Do not create the GitHub repo, tag, push or publish. List the exact commands for the writer at the end, including `gh repo create Firextream/Yazi --public --source . --push` and `gh release create`.

## A4. Name and icon (writer decides the name)
14. App icon set (ico/png all sizes, installer, taskbar, README) once the writer picks the final name; ASCII-safe name everywhere (repo, installer, exe, data folder), Turkish spelling only in display text if kept. Do not rename anything until the name is confirmed.
15. **Themes.** Today Settings has only "Warm paper" (light) and "After hours" (dark). Add "Match Windows" (follows the system light/dark setting) and 3–4 more calm, colourful-but-quiet themes, never plain black-and-white or generic grey (for example: sage green paper, dusty blue ink, warm terracotta evening, deep plum night), each with its own accent, all built on the same CSS tokens; switchable from Settings and from the command/shortcut sheet, applied instantly, remembered. Check contrast (WCAG AA) for text and underlines in every theme.
