import { useEffect, useState } from 'react'
import { desktop } from '../shared/api'
import { localDay } from '../projects/writing-log'
import { ai, compatiblePresets, usageLine } from './ai'
import type { AiConfig, AiProvider, AiStatus } from './ai'

const message = (e: unknown) => e instanceof Error ? e.message : String(e)
const providers: { id: AiProvider; label: string }[] = [{ id: 'anthropic', label: 'Anthropic (Claude)' }, { id: 'openai', label: 'OpenAI' }, { id: 'openai-compatible', label: 'Other OpenAI-compatible service' }]

// Settings → AI. Off by default; Yazı works fully without it.
export function AiSettings() {
  const [status, setStatus] = useState<AiStatus | null>(null), [form, setForm] = useState<AiConfig | null>(null)
  const [key, setKey] = useState(''), [working, setWorking] = useState(false), [note, setNote] = useState(''), [problem, setProblem] = useState('')
  useEffect(() => { if (desktop) void ai.status().then(next => { setStatus(next); setForm(next.config) }).catch(error => setProblem(message(error))) }, [])
  async function run(action: () => Promise<string | void>) {
    setWorking(true); setProblem(''); setNote('')
    try { const result = await action(); if (result) setNote(result) } catch (error) { setProblem(message(error)) } finally { setWorking(false) }
  }
  if (!desktop) return <section className="ai-settings"><div className="section-label">AI (OPTIONAL)</div><p className="quiet">AI features run from the desktop app, which keeps the API key in Windows Credential Manager.</p></section>
  if (!status || !form) return <section className="ai-settings"><div className="section-label">AI (OPTIONAL)</div>{problem ? <p className="research-problem" role="alert">{problem}</p> : <p className="quiet">Loading AI settings…</p>}</section>
  const month = localDay().slice(0, 7), hasKey = status.hasKey[form.provider], local = form.provider === 'openai-compatible' && /^http:\/\/(localhost|127\.0\.0\.1)/.test(form.baseUrl)
  const saved = JSON.stringify(form) === JSON.stringify(status.config), over = form.monthlyLimitUsd !== null && status.config.usage.month === month && status.config.usage.costUsd >= form.monthlyLimitUsd
  const save = () => run(async () => { const next = await ai.save(form); setStatus(next); setForm(next.config); return 'AI settings saved.' })
  return <section className="ai-settings" aria-labelledby="ai-settings-title">
    <div className="section-label" id="ai-settings-title">AI (OPTIONAL)</div>
    <label className="acknowledge"><input type="checkbox" checked={form.enabled} onChange={event => setForm({ ...form, enabled: event.target.checked })}/> Use AI in Yazı</label>
    <p className="quiet">Nothing runs in the background. AI helps only when you click, its answers are labelled “AI”, and it never writes into your text.</p>
    {form.enabled && <>
      <label className="field">Provider<select value={form.provider} onChange={event => { const provider = event.target.value as AiProvider; setForm({ ...form, provider, model: provider === 'anthropic' ? status.models[0].id : provider === status.config.provider ? status.config.model : '', baseUrl: provider === 'openai-compatible' ? form.baseUrl : '' }); setKey('') }}>{providers.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
      {form.provider === 'openai-compatible' && <label className="field">Service address<input list="ai-presets" placeholder="https://… or http://localhost:…" value={form.baseUrl} onChange={event => setForm({ ...form, baseUrl: event.target.value })}/><datalist id="ai-presets">{compatiblePresets.map(p => <option key={p.url} value={p.url} label={p.label}/>)}</datalist><small>Presets: {compatiblePresets.map(p => p.label).join(', ')}. Check the address in the service's documentation.</small></label>}
      {form.provider === 'anthropic'
        ? <label className="field">Model<select value={form.model} onChange={event => setForm({ ...form, model: event.target.value })}>{status.models.map(m => <option key={m.id} value={m.id}>{m.label} · ${m.inputPerMtok} / ${m.outputPerMtok} per million tokens in / out</option>)}</select></label>
        : <label className="field">Model<input placeholder="The model name, as the service writes it" value={form.model} onChange={event => setForm({ ...form, model: event.target.value })}/><small>Yazı does not know this service's prices, so costs are counted in tokens only.</small></label>}
      <div className="field ai-key"><span>API key{local ? ' (often not needed for a local model)' : ''}</span>
        {hasKey && <p className="ai-key-stored">A key is stored in Windows Credential Manager. <button type="button" className="popover-text" disabled={working} onClick={() => void run(async () => { await ai.forgetKey(form.provider); setStatus({ ...status, hasKey: { ...status.hasKey, [form.provider]: false } }); return 'The key was removed from this computer.' })}>Remove key</button></p>}
        <div className="ai-key-row"><input type="password" autoComplete="off" spellCheck={false} aria-label="API key" placeholder={hasKey ? 'Paste a new key to replace it' : 'Paste the API key'} value={key} onChange={event => setKey(event.target.value)}/><button type="button" className="outline-button" disabled={working || !key.trim()} onClick={() => void run(async () => { await ai.setKey(form.provider, key); setKey(''); setStatus({ ...status, hasKey: { ...status.hasKey, [form.provider]: true } }); return 'Key stored in Windows Credential Manager.' })}>Store key</button></div>
        <small>The key stays in Windows Credential Manager. It is never saved in your projects, backups or exports.</small></div>
      <label className="field">Monthly soft limit (USD)<input type="number" min="0" step="1" placeholder="No limit" value={form.monthlyLimitUsd ?? ''} onChange={event => setForm({ ...form, monthlyLimitUsd: event.target.value === '' ? null : Number(event.target.value) })}/><small>Yazı warns when this month's estimated cost reaches it; it never stops you.</small></label>
      <p className={`ai-usage ${over ? 'over' : ''}`}>{usageLine(status.config.usage, month)}{over && ' · over your monthly limit'}</p>
      <p className="quiet ai-billing">Costs are billed by the provider on this API key, separately from any Claude or ChatGPT subscription. A local model means nothing leaves this computer (except pages you fetch). Cloud providers receive the topic and source text you send.</p>
    </>}
    {problem && <p className="research-problem" role="alert">{problem}</p>}
    {note && <p className="ai-note" role="status">{note}</p>}
    <div className="ai-actions"><button type="button" className="outline-button" disabled={working || saved} onClick={() => void save()}>Save AI settings</button>{form.enabled && <button type="button" className="outline-button" disabled={working || !saved || !hasKey && !local} title={!saved ? 'Save the AI settings first' : undefined} onClick={() => void run(() => ai.test())}>{working ? 'Checking…' : 'Test connection'}</button>}</div>
  </section>
}
