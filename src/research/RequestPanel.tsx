import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { api, desktop } from '../shared/api'
import type { Research } from '../shared/types'
import { localDay } from '../projects/writing-log'
import { AI_STUDIO_BILLING, ai, aiError, costNote, money, searchRoute, serviceLabel } from '../settings/ai'
import type { AiAnswer, AiProvider, AiSearchResult, AiStatus } from '../settings/ai'
import { AiCandidates } from './AiCandidates'
import type { Annotations } from './useResearch'
import { t, tn } from '../i18n'

export type ResearchRequest = { id: string; topic: string; angle?: string; language: 'en' | 'tr'; count: number; createdAt: string }
type Form = { topic: string; angle: string; language: 'en' | 'tr'; count: number }
const message = (e: unknown) => e instanceof Error ? e.message : String(e)

// "Search about this topic": with AI connected, a web search the writer starts; without it, a request
// file plus a ready-to-paste prompt, answered by whoever writes source files into the inbox.
export function RequestPanel({ projectId, projectTitle, language, suggestTopic, research, reload, saveAnnotations, prefill, openSettings }: { prefill?: { topic: string; at: number } | null; openSettings: () => void; projectId: string; projectTitle: string; language: 'en' | 'tr'; suggestTopic: () => string; research: Research | null; reload: () => Promise<unknown>; saveAnnotations: (change: (current: Annotations) => Partial<Annotations>) => Promise<void> }) {
  const [form, setForm] = useState<Form | null>(null)
  const [made, setMade] = useState<{ request: ResearchRequest; prompt: string; path: string } | null>(null)
  const [working, setWorking] = useState(false), [problem, setProblem] = useState(''), [problemCode, setProblemCode] = useState(''), [copied, setCopied] = useState<'yes' | 'failed' | ''>('')
  const [unsourced, setUnsourced] = useState<{ topic: string; provider: AiProvider; reply: AiAnswer; saved: boolean } | null>(null)
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null), [found, setFound] = useState<{ topic: string; provider: AiProvider; result: AiSearchResult } | null>(null), [confirmOver, setConfirmOver] = useState(false)
  const requests = (research as (Research & { requests?: ResearchRequest[] }) | null)?.requests ?? []
  const latest = made?.request ?? requests[requests.length - 1]
  const arrived = latest ? research?.sources.filter(s => s.origin === 'inbox' && s.addedAt >= latest.createdAt).length ?? 0 : 0
  const month = localDay().slice(0, 7), config = aiStatus?.config
  const aiOn = !!config?.enabled, route = searchRoute(aiStatus), canSearch = !!route
  // Text from the Sources box that is not an address arrives here as the topic.
  useEffect(() => { if (prefill) void openForm(prefill.topic) }, [prefill?.at])
  async function openForm(topic?: string) {
    if (working) return
    setWorking(true); setProblem(''); setProblemCode(''); setConfirmOver(false); setUnsourced(null)
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
  async function searchWithAi(confirmed = false, via?: 'service') {
    if (!form || working) return
    setWorking(true); setProblem(''); setProblemCode('')
    try {
      // Settings may have changed while this form stayed open. Use the provider and limit now saved.
      const latest = await ai.status(); setAiStatus(latest)
      const current = latest.config
      if (!searchRoute(latest) || via && !latest.searchReady) {
        setConfirmOver(false)
        throw new Error(t('AI settings changed. Check Settings → AI or save a request instead.'))
      }
      if (!confirmed && current.monthlyLimitUsd !== null && current.usage.month === month && current.usage.costUsd >= current.monthlyLimitUsd) {
        setConfirmOver(true); return
      }
      setConfirmOver(false); setFound(null)
      const result = await ai.search({ ...form, topic: form.topic.trim(), angle: form.angle.trim(), projectTitle, month, ...(via ? { via } : {}) })
      setFound({ topic: form.topic.trim(), provider: current.provider, result }); setForm(null)
    } catch (error) { const e = aiError(error); setProblem(e.text); setProblemCode(e.code) }
    finally { setWorking(false); void ai.status().then(setAiStatus).catch(() => {}) }
  }
  // Offered when web search is not available on the key: the model's own knowledge, labelled unsourced.
  async function askUnsourced() {
    if (!form || working) return
    setWorking(true); setProblem(''); setProblemCode('')
    try {
      const provider = (await ai.status()).config.provider
      const reply = await ai.askUnsourced({ ...form, topic: form.topic.trim(), angle: form.angle.trim(), projectTitle, month })
      setUnsourced({ topic: form.topic.trim(), provider, reply, saved: false }); setForm(null)
    } catch (error) { const e = aiError(error); setProblem(e.text); setProblemCode(e.code === 'no-search-quota' ? '' : e.code) }
    finally { setWorking(false); void ai.status().then(setAiStatus).catch(() => {}) }
  }
  async function keepUnsourced() {
    if (!unsourced) return
    const now = new Date().toISOString()
    try {
      await saveAnnotations(current => ({ notes: [...current.notes, { id: crypto.randomUUID(), title: t('Unsourced AI answer: {topic}', { topic: unsourced.topic }), body: `${unsourced.reply.answer}\n\n_${t('No web search was used ({model}). Check every claim before you rely on it.', { model: unsourced.reply.usage.model })}_`, createdAt: now, updatedAt: now }] }))
      setUnsourced({ ...unsourced, saved: true })
    } catch (error) { setProblem(message(error)) }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(made!.prompt); setCopied('yes') } catch { setCopied('failed') }
  }
  return <div className="request-panel">
    {!form && !found && !unsourced && <button className="outline-button search-topic" disabled={working} onClick={() => void openForm()}>{t('Search about this topic')}</button>}
    {form && <form className="request-form" onSubmit={event => void save(event)} aria-label={t('Search about this topic')}>
      <label className="field">{t('Topic')}<input autoFocus value={form.topic} onChange={event => setForm({ ...form, topic: event.target.value })}/></label>
      <label className="field">{t('Angle')}<input placeholder={t('Optional: what you want to know')} value={form.angle} onChange={event => setForm({ ...form, angle: event.target.value })}/></label>
      <div className="request-row"><label className="field">{t('Language')}<select value={form.language} onChange={event => setForm({ ...form, language: event.target.value as 'en' | 'tr' })}><option value="en">{t('English')}</option><option value="tr">{t('Turkish')}</option></select></label>
        <label className="field">{t('Sources')}<input type="number" min={1} max={canSearch ? 10 : 20} value={form.count} onChange={event => setForm({ ...form, count: Number(event.target.value) })}/></label></div>
      {confirmOver && <div className="long-quote" role="alert"><p>{t('This month’s AI cost is about {cost}, over your limit of {limit}. Search anyway?', { cost: money(config!.usage.costUsd), limit: money(config!.monthlyLimitUsd!) })}</p><div><button type="button" className="outline-button" onClick={() => void searchWithAi(true)}>{t('Search anyway')}</button><button type="button" onClick={() => setConfirmOver(false)}>{t('Cancel')}</button></div></div>}
      <div className="card-form-actions">
        {canSearch && <button type="button" className="accent-button" disabled={working || !form.topic.trim()} onClick={() => void searchWithAi()}>{working ? t('Searching the web…') : t('Search with AI')}</button>}
        <button className={canSearch ? 'outline-button' : 'accent-button'} disabled={working || !form.topic.trim()}>{canSearch ? t('Save a request instead') : working ? t('Saving…') : t('Save request')}</button>
        <button type="button" disabled={working} onClick={() => setForm(null)}>{t('Cancel')}</button></div>
      {route === 'native' && <p className="quiet request-ai-note">{t('Search with AI uses {model}. You choose which sources to keep; Divit then saves the real pages.', { model: aiStatus!.price?.label ?? config!.model })}</p>}
      {route === 'service' && <p className="quiet request-ai-note">{t('{service} finds the pages; {model} ranks and summarises them. You choose which sources to keep; Divit then saves the real pages.', { service: serviceLabel(aiStatus), model: aiStatus!.price?.label ?? config!.model })}</p>}
      {aiOn && !canSearch && <p className="quiet request-ai-note">{aiStatus?.capabilities.keyRequired && !aiStatus.hasKey[config!.provider] ? t('Add an API key in Settings → AI to search with AI.') : t('Searching the web needs Gemini (with billing), Claude, or a search service such as Tavily in Settings → AI.')}</p>}
    </form>}
    {problem && <p className="research-problem" role="alert">{problem}</p>}
    {problemCode === 'no-search-quota' && form && <div className="problem-actions">{aiStatus?.searchReady && <button type="button" className="outline-button" disabled={working} onClick={() => void searchWithAi(true, 'service')}>{t('Search with {service} instead', { service: serviceLabel(aiStatus) })}</button>}<button type="button" className="outline-button" disabled={working} onClick={() => void askUnsourced()}>{working ? t('Asking…') : t('Ask without web search')}</button><button type="button" className="popover-text" onClick={() => void api.openLink(AI_STUDIO_BILLING)}>{t('Turn on billing ↗')}</button><button type="button" className="popover-text" onClick={openSettings}>{t('Choose another provider')}</button></div>}
    {problemCode === 'billing' && <div className="problem-actions"><button type="button" className="popover-text" onClick={() => void api.openLink(AI_STUDIO_BILLING)}>{t('Open AI Studio billing ↗')}</button></div>}
    {unsourced && <div className="ai-unsourced" role="region" aria-label={t('Answer without web search')}>
      <p className="unsourced-label"><span className="ai-label">{t('AI · unsourced')}</span> {t('No web search was used: this comes from the model’s own knowledge. Check every claim before you use it.')}</p>
      <div className="unsourced-text">{unsourced.reply.answer}</div>
      <p className="ai-spend">{t('{input} in / {output} out tokens', { input: unsourced.reply.usage.inputTokens, output: unsourced.reply.usage.outputTokens })}{unsourced.reply.usage.costUsd !== null ? ` · ${t('about {cost}', { cost: money(unsourced.reply.usage.costUsd) })}${costNote(unsourced.provider)}` : ''}</p>
      <div className="highlight-actions">{unsourced.saved ? <span className="used-label">{t('Saved to Notes')}</span> : <button className="popover-text" onClick={() => void keepUnsourced()}>{t('Save to Notes')}</button>}<button className="popover-text" onClick={() => setUnsourced(null)}>{t('Done')}</button></div>
    </div>}
    {found && <AiCandidates projectId={projectId} topic={found.topic} provider={found.provider} result={found.result} reload={reload} saveAnnotations={saveAnnotations} close={() => setFound(null)}/>}
    {latest && !form && !found && !unsourced && <div className="request-status" aria-live="polite">
      <p><strong>{latest.topic}</strong> · {arrived ? tn(arrived, '{n} source arrived', '{n} sources arrived') : t('Waiting for sources…')}</p>
      {made && made.request.id === latest.id && <>
        <p className="quiet">{t('Ask Claude in chat to answer the request. The sources land in this project\'s inbox and appear here.')}</p>
        <div className="request-actions"><button className="popover-text" onClick={() => void copy()}>{t('Copy request')}</button>{copied === 'yes' && <span className="quiet">{t('Copied. Paste it into the chat.')}</span>}</div>
        {copied === 'failed' && <><p className="quiet">{t('The clipboard was not available. Copy the request here:')}</p><textarea className="request-prompt" readOnly rows={8} value={made.prompt} onFocus={event => event.currentTarget.select()}/></>}
        <p className="request-path" title={t('Request file')}>{made.path}</p>
      </>}
    </div>}
  </div>
}
