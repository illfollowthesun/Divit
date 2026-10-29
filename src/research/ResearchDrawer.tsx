import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { api, desktop } from '../shared/api'
import { ai } from '../settings/ai'
import { asUrl } from './source-input'
import { t } from '../i18n'
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

export function ResearchDrawer({ projectId, projectTitle, language, suggestTopic, research, reload, saveAnnotations, close, insert, sectionId, placeName, openSettings }: { projectId: string; projectTitle: string; language: 'en' | 'tr'; suggestTopic: () => string; research: Research | null; reload: () => Promise<unknown>; saveAnnotations: (change: (current: Annotations) => Partial<Annotations>) => Promise<void>; close: () => void; insert: InsertQuote; sectionId: string | null; placeName: (sectionId: string | null) => string; openSettings: () => void }) {
  const [tab, setTab] = useState<Tab>('Sources'), [insertAs, setInsertAs] = useState<'quote' | 'footnote'>('quote')
  const [url, setUrl] = useState(''), [working, setWorking] = useState(false), [problem, setProblem] = useState(''), [notice, setNotice] = useState('')
  const [query, setQuery] = useState(''), [type, setType] = useState('all'), [status, setStatus] = useState('all')
  const [openId, setOpenId] = useState<string | null>(null), [focusId, setFocusId] = useState<string | undefined>()
  const [pending, setPending] = useState<{ quote: string; source: ResearchSource; highlightId?: string; words: number } | null>(null)
  const [aiOn, setAiOn] = useState(false), [prefill, setPrefill] = useState<{ topic: string; at: number } | null>(null)
  const field = useRef<HTMLInputElement>(null)
  const address = asUrl(url), isTopic = !!url.trim() && !address
  // Asked again each time the box turns into a topic: Settings may have changed meanwhile.
  useEffect(() => { if (isTopic && desktop) void ai.status().then(status => setAiOn(status.config.enabled)).catch(() => setAiOn(false)) }, [isTopic])
  useEffect(() => { field.current?.focus() }, [])
  useEffect(() => { setOpenId(null); setPending(null) }, [projectId])
  const sources = research?.sources ?? [], open = sources.find(s => s.id === openId)
  const shown = sources.filter(s => (type === 'all' || s.type === type) && (status === 'all' || s.status === status) && (!query.trim() || [s.title, s.site, s.summary, s.topic, s.author].some(v => v?.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())))).sort((a, b) => b.addedAt.localeCompare(a.addedAt))
  function openSource(sourceId: string, highlightId?: string) { setOpenId(sourceId); setFocusId(highlightId) }
  async function addUrl(event: FormEvent) {
    event.preventDefault()
    if (working || !url.trim()) return
    if (!address) { setPrefill({ topic: url.trim(), at: Date.now() }); setUrl(''); return }
    setWorking(true); setProblem(''); setNotice('')
    try {
      const page = await api.research<{ html: string; url: string; contentType: string }>(projectId, 'fetch-page', { url: address })
      const { meta, text } = readablePage(page.html, page.url, page.contentType)
      const result = await api.research<{ source: ResearchSource; duplicate: boolean }>(projectId, 'add-source', { meta, text, origin: 'url' })
      await reload(); setUrl('')
      setNotice(result.duplicate ? t('Already saved: {title}', { title: result.source.title }) : t('Saved a readable copy: {title}', { title: result.source.title }))
    } catch (error) { setProblem(message(error)) } finally { setWorking(false) }
  }
  // The only way research text reaches the manuscript: the writer's own Insert, always with its citation.
  async function requestInsert(quote: string, source: ResearchSource, highlightId?: string, confirmed = false) {
    const words = wordCount(quote)
    if (!confirmed && words > LONG_QUOTE_WORDS) { setPending({ quote, source, highlightId, words }); return }
    setPending(null); setProblem(''); setNotice('')
    if (!insert(insertAs, quote, source)) { setProblem(t('Open the text you are writing, then insert.')); return }
    setNotice(insertAs === 'footnote' ? t('Quote inserted with its source as a footnote.') : t('Quote inserted with its source.'))
    // The bridge appends the use, so quick successive inserts are all recorded.
    try { await api.research(projectId, 'update-source', { sourceId: source.id, patch: { addUse: { sectionId, at: new Date().toISOString(), highlightId } } }); await reload() }
    catch (error) { setProblem(t('The quote is in your text, but marking the source as quoted failed: {reason}', { reason: message(error) })) }
  }
  const fresh = newInboxCount(research)
  return <aside id="research-drawer" className="research-drawer" aria-label={t('Research')} onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); if (pending) setPending(null); else if (open) setOpenId(null); else close() } }}>
    <div className="research-head"><div className="section-label">{t('RESEARCH')} <span>{sources.length}</span></div>{fresh > 0 && <span className="research-new">{t('{n} new', { n: fresh })}</span>}<button className="research-close" onClick={close} aria-label={t('Close research')}>×</button></div>
    {pending && <div className="long-quote" role="alert"><p>{t('This quote is {n} words. Quoting this much may need the author’s permission.', { n: pending.words })}</p><div><button className="outline-button" onClick={() => void requestInsert(pending.quote, pending.source, pending.highlightId, true)}>{t('Insert anyway')}</button><button onClick={() => setPending(null)}>{t('Cancel')}</button></div></div>}
    {problem && <p className="research-problem" role="alert">{problem}</p>}
    <p className="research-notice" role="status">{notice}</p>
    {open ? <SourceReader aiNotes={research?.ai.filter(n => n.sourceId === open.id) ?? []} projectId={projectId} source={open} back={() => setOpenId(null)} reload={reload} highlights={research?.highlights ?? []} save={saveAnnotations} focusHighlight={focusId} onInsert={(quote, highlightId) => void requestInsert(quote, open, highlightId)} placeName={placeName}/> : <>
      <div className="research-tabs" role="tablist" aria-label={t('Research tabs')}>{tabs.map(name => <button key={name} role="tab" id={`research-tab-${name}`} aria-selected={tab === name} aria-controls="research-panel" className={tab === name ? 'active' : ''} onClick={() => setTab(name)}>{t(name)}{name === 'Highlights' && research?.highlights.length ? <span> {research.highlights.length}</span> : null}</button>)}</div>
      <div id="research-panel" role="tabpanel" aria-labelledby={`research-tab-${tab}`}>
        {tab === 'Sources' && <>
          <form className="add-url" onSubmit={event => void addUrl(event)}><label className="sr-only" htmlFor="research-url">{t('Web address to save, or a topic to search')}</label><input id="research-url" ref={field} type="text" placeholder={t('Paste a link, or type a topic')} value={url} disabled={working} onChange={event => setUrl(event.target.value)} aria-describedby={isTopic ? 'research-url-hint' : undefined}/><button className="outline-button" disabled={working || !url.trim()}>{working ? t('Saving…') : isTopic ? aiOn ? t('Search this with AI') : t('Search') : t('Add')}</button></form>
          {isTopic && <p id="research-url-hint" className="quiet add-url-hint">{aiOn ? t('Not a web address, so it will be searched as a topic.') : <>{t('Not a web address.')} <button type="button" className="text-link" onClick={openSettings}>{t('Turn on AI in Settings to search')}</button>{t(', or press Search to save a request.')}</>}</p>}
          <RequestPanel key={projectId} prefill={prefill} openSettings={openSettings} projectId={projectId} projectTitle={projectTitle} language={language} suggestTopic={suggestTopic} research={research} reload={reload} saveAnnotations={saveAnnotations}/>
          {sources.length > 0 && <div className="source-filters"><label className="sr-only" htmlFor="source-search">{t('Find a source')}</label><input id="source-search" placeholder={t('Find a source…')} value={query} onChange={event => setQuery(event.target.value)}/><select aria-label={t('Source type')} value={type} onChange={event => setType(event.target.value)}><option value="all">{t('All types')}</option>{types.map(kind => <option key={kind} value={kind}>{t(kind)}</option>)}</select><select aria-label={t('Reading status')} value={status} onChange={event => setStatus(event.target.value)}><option value="all">{t('Any status')}</option><option value="unread">{t('Unread')}</option><option value="read">{t('Read')}</option><option value="used">{t('Quoted')}</option></select></div>}
          <div className="source-list">{shown.map(source => <button key={source.id} className={`source-row ${source.status}`} onClick={() => openSource(source.id)}>
            <span className="source-title">{source.status === 'unread' && <span className="unread-dot" aria-label={t('Unread')}/>}{source.title}</span>
            <small>{[source.site, source.published ?? source.saved].filter(Boolean).join(' · ')}<span className="type-chip">{t(source.type)}</span>{source.status === 'used' && <span className="used-label">{t('Quoted')}</span>}{source.origin === 'ai-found' && <span className="ai-label">AI</span>}</small>
          </button>)}</div>
          {!sources.length && <p className="quiet research-empty">{t('Paste a link above, or drop source files into this project’s research/inbox folder. Nothing is searched unless you ask.')}</p>}
          {sources.length > 0 && !shown.length && <p className="quiet">{t('No source matches.')}</p>}
        </>}
        {tab === 'Highlights' && research && <HighlightsTab research={research} open={openSource} insert={(quote, source, highlightId) => void requestInsert(quote, source, highlightId)} insertAs={insertAs} setInsertAs={setInsertAs}/>}
        {tab === 'Notes' && research && <NotesTab research={research} save={saveAnnotations} openHighlight={id => { const h = research.highlights.find(item => item.id === id); if (h) openSource(h.sourceId, h.id) }}/>}
      </div>
    </>}
  </aside>
}
