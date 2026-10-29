# Yazı — Research panel ("Search about this topic")

Run AFTER POLISH_phase2.md is finished and committed. Plan first, wait for approval, then build in small commits.

## Idea
While writing a piece (post/story/chapter), the writer opens a **Research** side panel for that topic. It holds sources (articles, news, blogs, papers), the writer's notes, and highlights, and lets him drop quotes/links into the text. Claude (the assistant in chat) can search the web for a topic and deliver sources; the app itself stays offline-first and needs no API key.

## Design decisions (already made)
1. **AI is callable from inside the app (see 'In-app AI' below), but the app works fully without it.** Ways sources arrive:
   a. **Paste a URL** -> app fetches the page, extracts readable text (Readability-style, in the Rust side or via `@mozilla/readability`), saves a local snapshot.
   b. **Inbox folder**: `Documents\Yazi\<project>\research\inbox\*.md` — Claude (or any tool) drops files there; the app watches the folder and imports them. File format below.
2. Everything is plain files, readable without the app. Per piece: `Documents\Yazi\<project>\research\<piece-slug>\`
   - `sources\<id>.md` — frontmatter + saved readable text
   - `research.json` — index: source list, highlights, notes, tags
3. **Source file format** (inbox and saved):
   ```
   ---
   title: ...
   url: https://...
   site: ...
   author: ...
   published: 2026-10-20
   saved: 2026-10-29
   type: news | article | blog | paper | other
   topic: <topic heading it was searched for>
   summary: 2-3 sentence summary
   ---
   Readable text (markdown). Keep the original wording; never paraphrase silently.
   ```
4. Copyright: store snapshots for the writer's private research only; the **Insert quote** action always adds a citation (title, site, URL, date) and warns above ~50 words.

## UI (calm, few lines, same look as the rest of the app)
- Right drawer "Research" (shortcut Ctrl+Shift+R), tabs: **Sources**, **Highlights**, **Notes**.
- Sources: list with title, site, date, type chip; search/filter; "Add URL" field; badge for new inbox items ("3 new").
- Reader view for a source: select text -> small popover: **Highlight** (4 muted colors), **Add note**, **Insert quote**. Highlights stored as text-range + quote text (re-anchor by quote if the file changes).
- Highlights tab: all highlights across sources for this piece, grouped by source, each with its note; click -> jump to source; **Insert** puts `> quote` + `— Title, Site (date), URL` at the cursor, or as a footnote.
- Notes tab: free notes for the topic, plain markdown, can be linked to a highlight.
- **"Search about this topic" button**: for the current heading/selection it creates a request file `research\requests\<id>.md` (topic, angle, language, how many sources) and shows "Waiting for sources…". The writer then asks Claude in chat, Claude searches and writes results into `research\inbox\`. Also a "Copy request" button that puts a ready-to-paste prompt on the clipboard. With AI connected, this button runs the search directly (see below) instead of waiting.
- Per-source status: unread / read / used. A used source shows where it was quoted.
- Export (Pandoc): optional "Sources" list at the end of the piece, built from used sources.

## Acceptance
- Add URL -> readable snapshot saved, works offline afterwards.
- Dropping a file in `inbox` imports it within ~2 s, no duplicates (dedupe by URL).
- Highlight survives app restart and edits to the piece (they live in the source, not the manuscript).
- Insert quote always includes citation.
- Included in the daily backup zip and snapshots.
- No network calls except: explicit "Add URL" fetch, and AI calls the writer triggers himself.

## Order of work
1. Data model + file layout + inbox watcher  2. Sources list + Add URL  3. Reader + highlights  4. Highlights/Notes tabs + Insert quote  5. Request file + copy prompt  6. Export sources list.
Commit after each step. Update docs\ARCHITECTURE (or README) with the file format.

## In-app AI (decided: the writer wants to call AI from inside the app)
- **Settings -> AI**: provider dropdown (Anthropic default; OpenAI as second), model dropdown, API key field. Key stored in Windows Credential Manager (Tauri keyring plugin), never in project files, never in backups/exports. "Test connection" button. AI off by default; everything hides cleanly when no key is set.
- Calls go from the Rust side (not the webview) so the key never touches JS or logs. Show a small usage line (tokens / rough cost) after each call; configurable monthly soft limit with a warning.
- **Features (all manual, triggered by a click, nothing runs in the background):**
  1. **Search about this topic** — uses the provider's web search tool (Anthropic `web_search` tool). Input: current heading/selection + angle + language + count (default 5). Output: source cards written exactly like `inbox` files (same frontmatter, real URL, short summary, readable excerpt). Mark each as `ai-found`; the writer approves/discards each card before it is kept. Fetch the full page text locally afterwards (same code as Add URL) so the saved text is the real page, not the model's paraphrase.
  2. **Summarize this source** (short, with the key claims listed).
  3. **Ask this source** — question about one saved source; the answer must quote the passage it relies on.
  4. **Find angles** — 5 possible angles/questions for the topic from the saved sources. Never writes manuscript text. The AI never inserts text into the piece by itself; only the writer's "Insert quote" does.
- Every AI output is labeled "AI" in the UI and stored separately from the writer's own notes (`ai` field in research.json), so it is never mixed into his writing.
- Language: follows the writer's choice per request (EN/TR), default = piece language.
- Costs are billed by the provider on the API key (separate from any Claude/ChatGPT subscription) — mention this in the Settings help text.
- Errors: clear messages (no key, rate limit, offline); a failed call never loses anything.

Updated order of work: add step 7 after step 5 — Settings -> AI + keyring, 8 — Search about this topic via API, 9 — summarize / ask source / find angles.

## Providers (decided: general users, not only Emir — keep it open)
Build a provider abstraction (`AiProvider` interface) with capability flags: `nativeSearch`, `deepResearch`, `streaming`, `local`. UI shows only what the chosen provider can do.

| Provider | Search | Notes |
|---|---|---|
| Anthropic | native (`web_search` tool) | default |
| Google Gemini | native (Google Search grounding) + **Deep Research** agent | Deep Research is a long async job (minutes): start it, show "Researching…" with a cancel button, keep working, notify when done, import the report's cited sources as source cards. VERIFY the current API for it in the official Gemini docs before coding; if it is not available through the public API, ship grounding only and say so. |
| OpenAI | native (web search tool) | second |
| Kimi (Moonshot) | native web search tool (verify in docs) | OpenAI-compatible API |
| DeepSeek | none | needs the search fallback below |
| Local (Ollama / LM Studio, OpenAI-compatible at localhost) | none | small models: use only for summarize / ask-source / find-angles; needs the search fallback for search |

**Search fallback for providers without native search:** the app does the search itself through a user-chosen search backend — Brave Search API, Tavily, or the user's own SearXNG URL — then fetches the pages locally (same code as Add URL) and gives the model only the extracted text to summarize. Settings -> AI has a separate "Search provider" block with its own key. If none is set, the search button is disabled with a one-line explanation.

**Generic OpenAI-compatible provider:** custom base URL + model name + key, so any other service (Kimi, DeepSeek, OpenRouter, Groq, local) works without a code change. Presets just prefill URLs.

**Privacy line in Settings:** "Local model = nothing leaves this computer (except page fetches). Cloud providers receive the topic text and source text you send."

Rules that apply to every provider: key in OS keychain, calls from Rust side, manual triggers only, AI output labeled and stored separately, approve/discard each found source, saved text is always the real fetched page. Add step 10 to the order of work: provider abstraction first (before step 7), then Anthropic, Gemini, generic OpenAI-compatible (covers Kimi/DeepSeek/local), search fallback; Gemini Deep Research last.
