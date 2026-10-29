import { useState } from 'react'
import type { FormEvent } from 'react'
import { api } from '../shared/api'
import type { Research } from '../shared/types'

export type ResearchRequest = { id: string; topic: string; angle?: string; language: 'en' | 'tr'; count: number; createdAt: string }
const message = (e: unknown) => e instanceof Error ? e.message : String(e)

// "Search about this topic" without AI: a request file plus a ready-to-paste prompt. Whoever answers
// (Claude in chat, another tool) writes source files into the inbox, which Yazı imports.
export function RequestPanel({ projectId, projectTitle, language, suggestTopic, research }: { projectId: string; projectTitle: string; language: 'en' | 'tr'; suggestTopic: () => string; research: Research | null }) {
  const [form, setForm] = useState<{ topic: string; angle: string; language: 'en' | 'tr'; count: number } | null>(null)
  const [made, setMade] = useState<{ request: ResearchRequest; prompt: string; path: string } | null>(null)
  const [working, setWorking] = useState(false), [problem, setProblem] = useState(''), [copied, setCopied] = useState<'yes' | 'failed' | ''>('')
  const requests = (research as (Research & { requests?: ResearchRequest[] }) | null)?.requests ?? []
  const latest = made?.request ?? requests[requests.length - 1]
  const arrived = latest ? research?.sources.filter(s => s.origin === 'inbox' && s.addedAt >= latest.createdAt).length ?? 0 : 0
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!form || working) return
    setWorking(true); setProblem(''); setCopied('')
    try { setMade(await api.research(projectId, 'add-request', { ...form, projectTitle })); setForm(null) } catch (error) { setProblem(message(error)) } finally { setWorking(false) }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(made!.prompt); setCopied('yes') } catch { setCopied('failed') }
  }
  return <div className="request-panel">
    {!form && <button className="outline-button search-topic" onClick={() => { setForm({ topic: suggestTopic(), angle: '', language, count: 5 }); setProblem('') }}>Search about this topic</button>}
    {form && <form className="request-form" onSubmit={event => void save(event)} aria-label="Search about this topic">
      <label className="field">Topic<input autoFocus value={form.topic} onChange={event => setForm({ ...form, topic: event.target.value })}/></label>
      <label className="field">Angle<input placeholder="Optional: what you want to know" value={form.angle} onChange={event => setForm({ ...form, angle: event.target.value })}/></label>
      <div className="request-row"><label className="field">Language<select value={form.language} onChange={event => setForm({ ...form, language: event.target.value as 'en' | 'tr' })}><option value="en">English</option><option value="tr">Turkish</option></select></label>
        <label className="field">Sources<input type="number" min={1} max={20} value={form.count} onChange={event => setForm({ ...form, count: Number(event.target.value) })}/></label></div>
      <div className="card-form-actions"><button className="accent-button" disabled={working || !form.topic.trim()}>{working ? 'Saving…' : 'Save request'}</button><button type="button" onClick={() => setForm(null)}>Cancel</button></div>
    </form>}
    {problem && <p className="research-problem" role="alert">{problem}</p>}
    {latest && !form && <div className="request-status" aria-live="polite">
      <p><strong>{latest.topic}</strong> · {arrived ? `${arrived} ${arrived === 1 ? 'source' : 'sources'} arrived` : 'Waiting for sources…'}</p>
      {made && made.request.id === latest.id && <>
        <p className="quiet">Ask Claude in chat to answer the request. The sources land in this project's inbox and appear here.</p>
        <div className="request-actions"><button className="popover-text" onClick={() => void copy()}>Copy request</button>{copied === 'yes' && <span className="quiet">Copied. Paste it into the chat.</span>}</div>
        {copied === 'failed' && <><p className="quiet">The clipboard was not available. Copy the request here:</p><textarea className="request-prompt" readOnly rows={8} value={made.prompt} onFocus={event => event.currentTarget.select()}/></>}
        <p className="request-path" title="Request file">{made.path}</p>
      </>}
    </div>}
  </div>
}
