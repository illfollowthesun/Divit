import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api, desktop } from '../shared/api'
import type { Research } from '../shared/types'
import { localDay } from '../projects/writing-log'
import { ai, money } from '../settings/ai'
import type { AiProvider, AiSearchResult, AiStatus } from '../settings/ai'
import { AiCandidates } from './AiCandidates'
import type { Annotations } from './useResearch'

export type ResearchRequest = { id: string; topic: string; angle?: string; language: 'en' | 'tr'; count: number; createdAt: string }
type Form = { topic: string; angle: string; language: 'en' | 'tr'; count: number }
const message = (e: unknown) => e instanceof Error ? e.message : String(e)

// "Search about this topic": with AI connected, a web search the writer starts; without it, a request
// file plus a ready-to-paste prompt, answered by whoever writes source files into the inbox.
export function RequestPanel({ projectId, projectTitle, language, suggestTopic, research, reload, saveAnnotations, prefill }: { prefill?: { topic: string; at: number } | null; projectId: string; projectTitle: string; language: 'en' | 'tr'; suggestTopic: () => string; research: Research | null; reload: () => Promise<unknown>; saveAnnotations: (change: (current: Annotations) => Partial<Annotations>) => Promise<void> }) {
  const [form, setForm] = useState<Form | null>(null)
  const [made, setMade] = useState<{ request: ResearchRequest; prompt: string; path: string } | null>(null)
  const [working, setWorking] = useState(false), [problem, setProblem] = useState(''), [copied, setCopied] = useState<'yes' | 'failed' | ''>('')
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null), [found, setFound] = useState<{ topic: string; provider: AiProvider; result: AiSearchResult } | null>(null), [confirmOver, setConfirmOver] = useState(false)
  const requests = (research as (Research & { requests?: ResearchRequest[] }) | null)?.requests ?? []
  const latest = made?.request ?? requests[requests.length - 1]
  const arrived = latest ? research?.sources.filter(s => s.origin === 'inbox' && s.addedAt >= latest.createdAt).length ?? 0 : 0
  const month = localDay().slice(0, 7), config = aiStatus?.config
  const aiOn = !!config?.enabled, canSearch = aiOn && !!aiStatus?.capabilities.nativeSearch && (!!aiStatus?.hasKey[config!.provider] || !aiStatus?.capabilities.keyRequired)
  // Text from the Sources box that is not an address arrives here as the topic.
  useEffect(() => { if (prefill) void openForm(prefill.topic) }, [prefill?.at])
  async function openForm(topic?: string) {
    if (working) return
    setWorking(true); setProblem(''); setConfirmOver(false)
    if (desktop) {
      try { setAiStatus(await ai.status()) } catch { setAiStatus(null) }
    }
    setFound(null); setForm({ topic: topic ?? suggestTopic(), angle: '', language, count: 5 }); setWorking(false)
  }
  async function save(event: FormEvent) {
    event.preventDefault()
    if (!form || working) return
    setWorking(true); setProblem(''); setCopied('')
    try { setMade(await api.research(projectId, 'add-request', { ...form, projectTitle })); setForm(null) } catch (error) { setProblem(message(error)) } finally { setWorking(false) }
  }
  async function searchWithAi(confirmed = false) {
    if (!form || working) return
    setWorking(true); setProblem('')
    try {
      // Settings may have changed while this form stayed open. Use the provider and limit now saved.
      const latest = await ai.status(); setAiStatus(latest)
      const current = latest.config
      if (!current.enabled || !latest.capabilities.nativeSearch || latest.capabilities.keyRequired && !latest.hasKey[current.provider]) {
        setConfirmOver(false)
        throw new Error('AI settings changed. Check Settings → AI or save a request instead.')
      }
      if (!confirmed && current.monthlyLimitUsd !== null && current.usage.month === month && current.usage.costUsd >= current.monthlyLimitUsd) {
        setConfirmOver(true); return
      }
      setConfirmOver(false); setFound(null)
      const result = await ai.search({ ...form, topic: form.topic.trim(), angle: form.angle.trim(), projectTitle, month })
      setFound({ topic: form.topic.trim(), provider: current.provider, result }); setForm(null)
    } catch (error) { setProblem(message(error)) }
    finally { setWorking(false); void ai.status().then(setAiStatus).catch(() => {}) }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(made!.prompt); setCopied('yes') } catch { setCopied('failed') }
  }
  return <div className="request-panel">
    {!form && !found && <button className="outline-button search-topic" disabled={working} onClick={() => void openForm()}>Search about this topic</button>}
    {form && <form className="request-form" onSubmit={event => void save(event)} aria-label="Search about this topic">
      <label className="field">Topic<input autoFocus value={form.topic} onChange={event => setForm({ ...form, topic: event.target.value })}/></label>
      <label className="field">Angle<input placeholder="Optional: what you want to know" value={form.angle} onChange={event => setForm({ ...form, angle: event.target.value })}/></label>
      <div className="request-row"><label className="field">Language<select value={form.language} onChange={event => setForm({ ...form, language: event.target.value as 'en' | 'tr' })}><option value="en">English</option><option value="tr">Turkish</option></select></label>
        <label className="field">Sources<input type="number" min={1} max={canSearch ? 10 : 20} value={form.count} onChange={event => setForm({ ...form, count: Number(event.target.value) })}/></label></div>
      {confirmOver && <div className="long-quote" role="alert"><p>This month's AI cost is about {money(config!.usage.costUsd)}, over your limit of {money(config!.monthlyLimitUsd!)}. Search anyway?</p><div><button type="button" className="outline-button" onClick={() => void searchWithAi(true)}>Search anyway</button><button type="button" onClick={() => setConfirmOver(false)}>Cancel</button></div></div>}
      <div className="card-form-actions">
        {canSearch && <button type="button" className="accent-button" disabled={working || !form.topic.trim()} onClick={() => void searchWithAi()}>{working ? 'Searching the web…' : 'Search with AI'}</button>}
        <button className={canSearch ? 'outline-button' : 'accent-button'} disabled={working || !form.topic.trim()}>{canSearch ? 'Save a request instead' : working ? 'Saving…' : 'Save request'}</button>
        <button type="button" disabled={working} onClick={() => setForm(null)}>Cancel</button></div>
      {canSearch && <p className="quiet request-ai-note">Search with AI uses {aiStatus!.price?.label ?? config!.model}. You choose which sources to keep; Yazı then saves the real pages.</p>}
      {aiOn && !canSearch && <p className="quiet request-ai-note">{aiStatus?.capabilities.nativeSearch ? 'Add an API key in Settings → AI to search with AI.' : 'Searching the web needs Gemini (paid key) or Claude in Settings → AI.'}</p>}
    </form>}
    {problem && <p className="research-problem" role="alert">{problem}</p>}
    {found && <AiCandidates projectId={projectId} topic={found.topic} provider={found.provider} result={found.result} reload={reload} saveAnnotations={saveAnnotations} close={() => setFound(null)}/>}
    {latest && !form && !found && <div className="request-status" aria-live="polite">
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
