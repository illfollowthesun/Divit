import { useRef, useState } from 'react'
import { api } from '../shared/api'
import type { AiNote, ResearchSource } from '../shared/types'
import type { AiCandidate, AiProvider, AiSearchResult } from '../settings/ai'
import { costNote, money } from '../settings/ai'
import { readablePage } from './readable'
import type { Annotations } from './useResearch'

const message = (e: unknown) => e instanceof Error ? e.message : String(e)
type CardState = { state: 'open' | 'saving' | 'kept' | 'discarded'; problem?: string }

// AI-found sources wait here until the writer keeps or discards each one. Keeping fetches the real page,
// so the saved text is never the model's paraphrase; the AI summary is stored apart, labelled AI.
export function AiCandidates({ projectId, topic, provider, result, reload, saveAnnotations, close }: { projectId: string; topic: string; provider: AiProvider; result: AiSearchResult; reload: () => Promise<unknown>; saveAnnotations: (change: (current: Annotations) => Partial<Annotations>) => Promise<void>; close: () => void }) {
  const [cards, setCards] = useState<Record<string, CardState>>({})
  // A later annotation/reload failure must not lose track of an already saved page.
  const savedPages = useRef(new Map<string, { source: ResearchSource; duplicate: boolean }>())
  const set = (url: string, next: CardState) => setCards(old => ({ ...old, [url]: next }))
  async function keep(candidate: AiCandidate) {
    set(candidate.url, { state: 'saving' })
    try {
      let added = savedPages.current.get(candidate.url)
      if (!added) {
        const page = await api.research<{ html: string; url: string; contentType: string }>(projectId, 'fetch-page', { url: candidate.url })
        const { meta, text } = readablePage(page.html, page.url, page.contentType)
        added = await api.research<{ source: ResearchSource; duplicate: boolean }>(projectId, 'add-source', { origin: 'ai-found', text, meta: { ...meta, topic, type: candidate.type !== 'other' ? candidate.type : meta.type, published: meta.published ?? (candidate.published || undefined) } })
        savedPages.current.set(candidate.url, added)
      }
      if (!added.duplicate && candidate.summary.trim()) {
        const note: AiNote = { id: crypto.randomUUID(), kind: 'summary', sourceId: added.source.id, body: candidate.summary.trim(), provider, model: result.usage.model, createdAt: new Date().toISOString() }
        await saveAnnotations(current => ({ ai: current.ai.some(n => n.sourceId === note.sourceId && n.kind === 'summary' && n.body === note.body && n.model === note.model) ? current.ai : [...current.ai, note] }))
      }
      await reload()
      set(candidate.url, { state: 'kept', problem: added.duplicate ? 'Already saved earlier.' : undefined })
    } catch (error) { set(candidate.url, { state: 'open', problem: `${message(error)} ${savedPages.current.has(candidate.url) ? 'The page is saved. Retry Keep to finish saving its summary and refreshing the list.' : 'Nothing was saved.'}` }) }
  }
  const { usage } = result, open = result.candidates.filter(c => !['kept', 'discarded'].includes(cards[c.url]?.state ?? 'open')).length
  return <div className="ai-candidates" aria-label="Sources found by AI">
    {result.via && <p className="search-via">{result.ranked === false ? `Found with ${result.via}, in its own order. ${result.rankProblem ?? ''} The text under each page is ${result.via}'s snippet, not AI.` : `Found with ${result.via}; ranked and summarised by ${usage.model}.`}</p>}
    <p className="ai-spend">This search: {usage.inputTokens.toLocaleString()} in / {usage.outputTokens.toLocaleString()} out tokens · {usage.webSearches} web {usage.webSearches === 1 ? 'search' : 'searches'}{usage.costUsd !== null ? ` · about ${money(usage.costUsd)}${costNote(provider)}` : ''} · this month about {money(usage.monthCostUsd)}{usage.overLimit ? ' · over your monthly limit' : ''}</p>
    {result.dropped > 0 && <p className="quiet">{result.dropped === 1 ? 'One suggestion was' : `${result.dropped} suggestions were`} left out because the address was not among the search results.</p>}
    {!result.candidates.length && <p className="quiet">No sources came back. Try a broader topic.</p>}
    {result.candidates.map(candidate => { const card = cards[candidate.url] ?? { state: 'open' }; return card.state === 'discarded' ? null : <article key={candidate.url} className={`ai-candidate ${card.state}`}>
      <div className="source-kind"><span className="ai-label">{result.via ? result.via : 'AI found'}</span><span className="type-chip">{candidate.type}</span>{candidate.published && <span>{candidate.published}</span>}</div>
      <h4>{candidate.title || candidate.site}</h4>
      <p className="source-url">{candidate.url}</p>
      {candidate.summary && <p className="ai-summary"><span className="ai-label">AI</span> {candidate.summary}</p>}
      {candidate.excerpt && <blockquote className="ai-excerpt">{candidate.excerpt}</blockquote>}
      {card.problem && <p className={card.state === 'kept' ? 'quiet' : 'research-problem'} role={card.state === 'kept' ? undefined : 'alert'}>{card.problem}</p>}
      <div className="highlight-actions">{card.state === 'kept' ? <span className="used-label">Kept: the page was saved</span> : <>
        <button className="popover-text" disabled={card.state === 'saving'} onClick={() => set(candidate.url, { state: 'discarded' })}>Discard</button>
        <button className="popover-text" disabled={card.state === 'saving'} onClick={() => void keep(candidate)}>{card.state === 'saving' ? 'Saving the page…' : 'Keep'}</button></>}</div>
    </article> })}
    {!open && result.candidates.length > 0 && <button className="text-link" onClick={close}>Done</button>}
  </div>
}
