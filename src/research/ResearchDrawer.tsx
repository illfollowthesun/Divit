import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../shared/api'
import type { Research, ResearchSource } from '../shared/types'
import { readablePage } from './readable'
import { SourceReader } from './SourceReader'
import { HighlightsTab } from './HighlightsTab'
import { NotesTab } from './NotesTab'
import { RequestPanel } from './RequestPanel'
import { LONG_QUOTE_WORDS, wordCount } from './citation'
import type { Annotations } from './useResearch'

const message = (e: unknown) => e instanceof Error ? e.message : String(e)
const types = ['news', 'article', 'blog', 'paper', 'other'] as const
const tabs = ['Sources', 'Highlights', 'Notes'] as const
type Tab = typeof tabs[number]
export type InsertQuote = (kind: 'quote' | 'footnote', quote: string, source: ResearchSource) => boolean
export const newInboxCount = (research: Research | null) => research?.sources.filter(s => s.origin === 'inbox' && s.status === 'unread').length ?? 0

export function ResearchDrawer({ projectId, projectTitle, language, suggestTopic, research, reload, saveAnnotations, close, insert, sectionId, placeName }: { projectId: string; projectTitle: string; language: 'en' | 'tr'; suggestTopic: () => string; research: Research | null; reload: () => Promise<unknown>; saveAnnotations: (change: (current: Annotations) => Partial<Annotations>) => Promise<void>; close: () => void; insert: InsertQuote; sectionId: string | null; placeName: (sectionId: string | null) => string }) {
  const [tab, setTab] = useState<Tab>('Sources'), [insertAs, setInsertAs] = useState<'quote' | 'footnote'>('quote')
  const [url, setUrl] = useState(''), [working, setWorking] = useState(false), [problem, setProblem] = useState(''), [notice, setNotice] = useState('')
  const [query, setQuery] = useState(''), [type, setType] = useState('all'), [status, setStatus] = useState('all')
  const [openId, setOpenId] = useState<string | null>(null), [focusId, setFocusId] = useState<string | undefined>()
  const [pending, setPending] = useState<{ quote: string; source: ResearchSource; highlightId?: string; words: number } | null>(null)
  const field = useRef<HTMLInputElement>(null)
  useEffect(() => { field.current?.focus() }, [])
  useEffect(() => { setOpenId(null); setPending(null) }, [projectId])
  const sources = research?.sources ?? [], open = sources.find(s => s.id === openId)
  const shown = sources.filter(s => (type === 'all' || s.type === type) && (status === 'all' || s.status === status) && (!query.trim() || [s.title, s.site, s.summary, s.topic, s.author].some(v => v?.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())))).sort((a, b) => b.addedAt.localeCompare(a.addedAt))
  function openSource(sourceId: string, highlightId?: string) { setOpenId(sourceId); setFocusId(highlightId) }
  async function addUrl(event: FormEvent) {
    event.preventDefault()
    if (working || !url.trim()) return
    setWorking(true); setProblem(''); setNotice('')
    try {
      const page = await api.research<{ html: string; url: string; contentType: string }>(projectId, 'fetch-page', { url: url.trim() })
      const { meta, text } = readablePage(page.html, page.url, page.contentType)
      const result = await api.research<{ source: ResearchSource; duplicate: boolean }>(projectId, 'add-source', { meta, text, origin: 'url' })
      await reload(); setUrl('')
      setNotice(result.duplicate ? `Already saved: ${result.source.title}` : `Saved a readable copy: ${result.source.title}`)
    } catch (error) { setProblem(message(error)) } finally { setWorking(false) }
  }
  // The only way research text reaches the manuscript: the writer's own Insert, always with its citation.
  async function requestInsert(quote: string, source: ResearchSource, highlightId?: string, confirmed = false) {
    const words = wordCount(quote)
    if (!confirmed && words > LONG_QUOTE_WORDS) { setPending({ quote, source, highlightId, words }); return }
    setPending(null); setProblem(''); setNotice('')
    if (!insert(insertAs, quote, source)) { setProblem('Open the text you are writing, then insert.'); return }
    try {
      await api.research(projectId, 'update-source', { sourceId: source.id, patch: { status: 'used', usedIn: [...source.usedIn, { sectionId, at: new Date().toISOString(), highlightId }] } })
      await reload(); setNotice(`Quote inserted with its source${insertAs === 'footnote' ? ' as a footnote' : ''}.`)
    } catch (error) { setProblem(message(error)) }
  }
  const fresh = newInboxCount(research)
  return <aside id="research-drawer" className="research-drawer" aria-label="Research" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); if (pending) setPending(null); else if (open) setOpenId(null); else close() } }}>
    <div className="research-head"><div className="section-label">RESEARCH <span>{sources.length}</span></div>{fresh > 0 && <span className="research-new">{fresh} new</span>}<button className="research-close" onClick={close} aria-label="Close research">×</button></div>
    {pending && <div className="long-quote" role="alert"><p>This quote is {pending.words} words. Quoting this much may need the author’s permission.</p><div><button className="outline-button" onClick={() => void requestInsert(pending.quote, pending.source, pending.highlightId, true)}>Insert anyway</button><button onClick={() => setPending(null)}>Cancel</button></div></div>}
    {problem && <p className="research-problem" role="alert">{problem}</p>}
    <p className="research-notice" role="status">{notice}</p>
    {open ? <SourceReader projectId={projectId} source={open} back={() => setOpenId(null)} reload={reload} highlights={research?.highlights ?? []} save={saveAnnotations} focusHighlight={focusId} onInsert={(quote, highlightId) => void requestInsert(quote, open, highlightId)} placeName={placeName}/> : <>
      <div className="research-tabs" role="tablist" aria-label="Research tabs">{tabs.map(name => <button key={name} role="tab" id={`research-tab-${name}`} aria-selected={tab === name} aria-controls="research-panel" className={tab === name ? 'active' : ''} onClick={() => setTab(name)}>{name}{name === 'Highlights' && research?.highlights.length ? <span> {research.highlights.length}</span> : null}</button>)}</div>
      <div id="research-panel" role="tabpanel" aria-labelledby={`research-tab-${tab}`}>
        {tab === 'Sources' && <>
          <form className="add-url" onSubmit={event => void addUrl(event)}><label className="sr-only" htmlFor="research-url">Web address to save</label><input id="research-url" ref={field} type="url" inputMode="url" placeholder="Paste a link to keep a readable copy" value={url} disabled={working} onChange={event => setUrl(event.target.value)}/><button className="outline-button" disabled={working || !url.trim()}>{working ? 'Saving…' : 'Add'}</button></form>
          <RequestPanel projectId={projectId} projectTitle={projectTitle} language={language} suggestTopic={suggestTopic} research={research}/>
          {sources.length > 0 && <div className="source-filters"><label className="sr-only" htmlFor="source-search">Find a source</label><input id="source-search" placeholder="Find a source…" value={query} onChange={event => setQuery(event.target.value)}/><select aria-label="Source type" value={type} onChange={event => setType(event.target.value)}><option value="all">All types</option>{types.map(t => <option key={t} value={t}>{t}</option>)}</select><select aria-label="Reading status" value={status} onChange={event => setStatus(event.target.value)}><option value="all">Any status</option><option value="unread">Unread</option><option value="read">Read</option><option value="used">Quoted</option></select></div>}
          <div className="source-list">{shown.map(source => <button key={source.id} className={`source-row ${source.status}`} onClick={() => openSource(source.id)}>
            <span className="source-title">{source.status === 'unread' && <span className="unread-dot" aria-label="Unread"/>}{source.title}</span>
            <small>{[source.site, source.published ?? source.saved].filter(Boolean).join(' · ')}<span className="type-chip">{source.type}</span>{source.status === 'used' && <span className="used-label">Quoted</span>}{source.origin === 'ai-found' && <span className="ai-label">AI</span>}</small>
          </button>)}</div>
          {!sources.length && <p className="quiet research-empty">Paste a link above, or drop source files into this project's <code>research/inbox</code> folder. Nothing is searched unless you ask.</p>}
          {sources.length > 0 && !shown.length && <p className="quiet">No source matches.</p>}
        </>}
        {tab === 'Highlights' && research && <HighlightsTab research={research} open={openSource} insert={(quote, source, highlightId) => void requestInsert(quote, source, highlightId)} insertAs={insertAs} setInsertAs={setInsertAs}/>}
        {tab === 'Notes' && research && <NotesTab research={research} save={saveAnnotations} openHighlight={id => { const h = research.highlights.find(item => item.id === id); if (h) openSource(h.sourceId, h.id) }}/>}
      </div>
    </>}
  </aside>
}
