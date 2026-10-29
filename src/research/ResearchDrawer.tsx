import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../shared/api'
import type { Research, ResearchSource } from '../shared/types'
import { readablePage } from './readable'
import { SourceReader } from './SourceReader'
import type { Annotations } from './useResearch'

const message = (e: unknown) => e instanceof Error ? e.message : String(e)
const types = ['news', 'article', 'blog', 'paper', 'other'] as const
export const newInboxCount = (research: Research | null) => research?.sources.filter(s => s.origin === 'inbox' && s.status === 'unread').length ?? 0

export function ResearchDrawer({ projectId, research, reload, saveAnnotations, close }: { projectId: string; research: Research | null; reload: () => Promise<unknown>; saveAnnotations: (change: (current: Annotations) => Partial<Annotations>) => Promise<void>; close: () => void }) {
  const [url, setUrl] = useState(''), [working, setWorking] = useState(false), [problem, setProblem] = useState(''), [notice, setNotice] = useState('')
  const [query, setQuery] = useState(''), [type, setType] = useState('all'), [status, setStatus] = useState('all'), [openId, setOpenId] = useState<string | null>(null)
  const field = useRef<HTMLInputElement>(null)
  useEffect(() => { field.current?.focus() }, [])
  useEffect(() => { setOpenId(null) }, [projectId])
  const sources = research?.sources ?? [], open = sources.find(s => s.id === openId)
  const shown = sources.filter(s => (type === 'all' || s.type === type) && (status === 'all' || s.status === status) && (!query.trim() || [s.title, s.site, s.summary, s.topic, s.author].some(v => v?.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase())))).sort((a, b) => b.addedAt.localeCompare(a.addedAt))
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
  const fresh = newInboxCount(research)
  return <aside id="research-drawer" className="research-drawer" aria-label="Research" onKeyDown={event => { if (event.key === 'Escape') { event.stopPropagation(); if (open) setOpenId(null); else close() } }}>
    <div className="research-head"><div className="section-label">RESEARCH <span>{sources.length}</span></div>{fresh > 0 && <span className="research-new">{fresh} new</span>}<button className="research-close" onClick={close} aria-label="Close research">×</button></div>
    {open ? <SourceReader projectId={projectId} source={open} back={() => setOpenId(null)} reload={reload} highlights={research?.highlights ?? []} save={saveAnnotations}/> : <>
      <form className="add-url" onSubmit={event => void addUrl(event)}><label className="sr-only" htmlFor="research-url">Web address to save</label><input id="research-url" ref={field} type="url" inputMode="url" placeholder="Paste a link to keep a readable copy" value={url} disabled={working} onChange={event => setUrl(event.target.value)}/><button className="outline-button" disabled={working || !url.trim()}>{working ? 'Saving…' : 'Add'}</button></form>
      {problem && <p className="research-problem" role="alert">{problem}</p>}
      <p className="research-notice" role="status">{notice}</p>
      {sources.length > 0 && <div className="source-filters"><label className="sr-only" htmlFor="source-search">Find a source</label><input id="source-search" placeholder="Find a source…" value={query} onChange={event => setQuery(event.target.value)}/><select aria-label="Source type" value={type} onChange={event => setType(event.target.value)}><option value="all">All types</option>{types.map(t => <option key={t} value={t}>{t}</option>)}</select><select aria-label="Reading status" value={status} onChange={event => setStatus(event.target.value)}><option value="all">Any status</option><option value="unread">Unread</option><option value="read">Read</option><option value="used">Quoted</option></select></div>}
      <div className="source-list">{shown.map(source => <button key={source.id} className={`source-row ${source.status}`} onClick={() => setOpenId(source.id)}>
        <span className="source-title">{source.status === 'unread' && <span className="unread-dot" aria-label="Unread"/>}{source.title}</span>
        <small>{[source.site, source.published ?? source.saved].filter(Boolean).join(' · ')}<span className="type-chip">{source.type}</span>{source.status === 'used' && <span className="used-label">Quoted</span>}{source.origin === 'ai-found' && <span className="ai-label">AI</span>}</small>
      </button>)}</div>
      {!sources.length && <p className="quiet research-empty">Paste a link above, or drop source files into this project's <code>research/inbox</code> folder. Nothing is searched unless you ask.</p>}
      {sources.length > 0 && !shown.length && <p className="quiet">No source matches.</p>}
    </>}
  </aside>
}
