import { useEffect, useState } from 'react'
import { desktop } from '../shared/api'
import { localDay } from '../projects/writing-log'
import { ai, compatiblePresets, localPresets, providers, searchServices, usageLine } from './ai'
import type { AiConfig, AiModel, AiProvider, AiStatus, SearchService } from './ai'

const message = (e: unknown) => e instanceof Error ? e.message : String(e)
const priceLabel = (m: AiModel, provider: AiProvider) => {
  const rates = m.fromMonth && localDay().slice(0, 7) >= m.fromMonth[0] ? m.fromMonth.slice(1) : [m.inputPerMtok, m.outputPerMtok]
  return `${m.label} · $${rates[0]} / $${rates[1]} per million tokens in / out${provider === 'gemini' ? ' on paid keys' : ''}`
}

// Settings → AI. Off by default; Yazı works fully without it.
export function AiSettings() {
  const [status, setStatus] = useState<AiStatus | null>(null), [form, setForm] = useState<AiConfig | null>(null)
  const [key, setKey] = useState(''), [searchKey, setSearchKey] = useState(''), [working, setWorking] = useState(false), [note, setNote] = useState(''), [problem, setProblem] = useState('')
  useEffect(() => { if (desktop) void ai.status().then(next => { setStatus(next); setForm(next.config) }).catch(error => setProblem(message(error))) }, [])
  async function run(action: () => Promise<string | void>) {
    setWorking(true); setProblem(''); setNote('')
    try { const result = await action(); if (result) setNote(result) } catch (error) { setProblem(message(error)) } finally { setWorking(false) }
  }
  if (!desktop) return <section className="ai-settings"><div className="section-label">AI (OPTIONAL)</div><p className="quiet">AI features run from the desktop app, which keeps the API key in Windows Credential Manager.</p></section>
  if (!status || !form) return <section className="ai-settings"><div className="section-label">AI (OPTIONAL)</div>{problem ? <p className="research-problem" role="alert">{problem}</p> : <p className="quiet">Loading AI settings…</p>}</section>
  const month = localDay().slice(0, 7), hasKey = status.hasKey[form.provider], keyOptional = form.provider === 'local'
  const models = form.provider === 'gemini' ? status.models.gemini : form.provider === 'anthropic' ? status.models.anthropic : null
  const model = models?.find(m => m.id === form.model), provider = providers.find(p => p.id === form.provider)!
  const saved = JSON.stringify(form) === JSON.stringify(status.config), over = form.monthlyLimitUsd !== null && status.config.usage.month === month && status.config.usage.costUsd >= form.monthlyLimitUsd
  const presets = form.provider === 'local' ? localPresets : compatiblePresets
  const search = form.search, service = searchServices.find(s => s.id === search.provider)!
  const keyedService = search.provider === 'tavily' || search.provider === 'brave' ? search.provider : null
  const hasSearchKey = keyedService ? status.hasSearchKey[keyedService] : false
  function choose(next: AiProvider) {
    const list = next === 'gemini' ? status!.models.gemini : next === 'anthropic' ? status!.models.anthropic : null
    const keep = next === status!.config.provider
    setForm({ ...form!, provider: next, model: keep ? status!.config.model : list?.[0].id ?? '', baseUrl: keep ? status!.config.baseUrl : next === 'local' ? localPresets[0].url : '', fallbacks: keep && status!.config.fallbacks })
    setKey('')
  }
  const save = () => run(async () => { const next = await ai.save(form); setStatus(next); setForm(next.config); return 'AI settings saved.' })
  return <section className="ai-settings" aria-labelledby="ai-settings-title">
    <div className="section-label" id="ai-settings-title">AI (OPTIONAL)</div>
    <label className="acknowledge"><input type="checkbox" checked={form.enabled} onChange={event => setForm({ ...form, enabled: event.target.checked })}/> Use AI in Yazı</label>
    <p className="quiet">Nothing runs in the background. AI helps only when you click, its answers are labelled “AI”, and it never writes into your text. Claude, ChatGPT or Gemini subscriptions cannot be used here: AI needs an API key, or a model on this computer.</p>
    {form.enabled && <>
      <label className="field"><span id="ai-provider-label">Provider</span><select aria-labelledby="ai-provider-label" aria-describedby="ai-provider-note" value={form.provider} onChange={event => choose(event.target.value as AiProvider)}>{providers.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select><small id="ai-provider-note" className="ai-provider-note">{provider.note}</small></label>
      {(form.provider === 'local' || form.provider === 'openai-compatible') && <label className="field">Service address<input list="ai-presets" placeholder={form.provider === 'local' ? 'http://localhost:…' : 'https://…'} value={form.baseUrl} onChange={event => setForm({ ...form, baseUrl: event.target.value })}/><datalist id="ai-presets">{presets.map(p => <option key={p.url} value={p.url} label={p.label}/>)}</datalist><small>Presets: {presets.map(p => `${p.label} ${p.url}`).join(' · ')}.</small></label>}
      {models
        ? <label className="field"><span id="ai-model-label">Model</span><select aria-labelledby="ai-model-label" value={form.model} onChange={event => { const id = event.target.value; setForm({ ...form, model: id, fallbacks: form.fallbacks && !!models.find(m => m.id === id)?.fallbacks }) }}>{models.map(m => <option key={m.id} value={m.id}>{priceLabel(m, form.provider)}</option>)}</select></label>
        : <label className="field"><span id="ai-model-label">Model</span><input aria-labelledby="ai-model-label" placeholder={form.provider === 'local' ? 'For example llama3.2, as Ollama or LM Studio lists it' : 'The model name, as the service writes it'} value={form.model} onChange={event => setForm({ ...form, model: event.target.value })}/><small>{form.provider === 'local' ? 'Local models cost nothing; usage is counted in tokens only.' : 'Yazı does not know this service\'s prices, so costs are counted in tokens only.'}</small></label>}
      {form.provider === 'anthropic' && <label className="acknowledge ai-fallbacks"><input type="checkbox" checked={form.fallbacks} disabled={!model?.fallbacks} onChange={event => setForm({ ...form, fallbacks: event.target.checked })}/> If Claude declines a request, retry it on Anthropic's recommended fallback model{model && !model.fallbacks ? ' (not available for this model)' : ''}</label>}
      <div className="field ai-key"><span>API key{keyOptional ? ' (usually not needed for a local model)' : ''}</span>
        {hasKey && <p className="ai-key-stored">A key is stored in Windows Credential Manager. <button type="button" className="popover-text" disabled={working} onClick={() => void run(async () => { await ai.forgetKey(form.provider); setStatus({ ...status, hasKey: { ...status.hasKey, [form.provider]: false } }); return 'The key was removed from this computer.' })}>Remove key</button></p>}
        <div className="ai-key-row"><input type="password" autoComplete="off" spellCheck={false} aria-label="API key" placeholder={hasKey ? 'Paste a new key to replace it' : 'Paste the API key'} value={key} onChange={event => setKey(event.target.value)}/><button type="button" className="outline-button" disabled={working || !key.trim()} onClick={() => void run(async () => { await ai.setKey(form.provider, key); setKey(''); setStatus({ ...status, hasKey: { ...status.hasKey, [form.provider]: true } }); return 'Key stored in Windows Credential Manager.' })}>Store key</button></div>
        <small>The key stays in Windows Credential Manager. It is never saved in your projects, backups or exports.</small></div>
      <fieldset className="search-service"><legend>Web search service (optional)</legend>
        <label className="field"><span id="search-service-label">Search service</span><select aria-labelledby="search-service-label" aria-describedby="search-service-note" value={search.provider} onChange={event => { setForm({ ...form, search: { ...search, provider: event.target.value as SearchService } }); setSearchKey('') }}>{searchServices.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}</select><small id="search-service-note">{service.note} {search.provider !== 'none' && 'The service finds pages; your AI model ranks and summarises them. Results are labelled with the service’s name.'}</small></label>
        {search.provider === 'searxng' && <label className="field">SearXNG address<input placeholder="http://localhost:8080" value={search.searxngUrl} onChange={event => setForm({ ...form, search: { ...search, searxngUrl: event.target.value } })}/></label>}
        {keyedService && <div className="field ai-key"><span>{service.label.replace(/ \(.*\)$/, '')} key</span>
          {hasSearchKey && <p className="ai-key-stored">A key is stored in Windows Credential Manager. <button type="button" className="popover-text" disabled={working} onClick={() => void run(async () => { await ai.forgetSearchKey(keyedService); const next = await ai.status(); setStatus(next); return 'The search key was removed from this computer.' })}>Remove search key</button></p>}
          <div className="ai-key-row"><input type="password" autoComplete="off" spellCheck={false} aria-label="Search service key" placeholder={hasSearchKey ? 'Paste a new key to replace it' : 'Paste the key'} value={searchKey} onChange={event => setSearchKey(event.target.value)}/><button type="button" className="outline-button" disabled={working || !searchKey.trim()} onClick={() => void run(async () => { await ai.setSearchKey(keyedService, searchKey); setSearchKey(''); const next = await ai.status(); setStatus(next); return 'Search key stored in Windows Credential Manager.' })}>Store search key</button></div></div>}
        {search.provider !== 'none' && <label className="acknowledge"><input type="checkbox" checked={search.always} onChange={event => setForm({ ...form, search: { ...search, always: event.target.checked } })}/> Use it even when the AI can search the web itself</label>}
      </fieldset>
      <label className="field">Monthly soft limit (USD)<input type="number" min="0" step="1" placeholder="No limit" value={form.monthlyLimitUsd ?? ''} onChange={event => setForm({ ...form, monthlyLimitUsd: event.target.value === '' ? null : Number(event.target.value) })}/><small>Yazı warns when this month's estimated cost reaches it; it never stops you.</small></label>
      <p className={`ai-usage ${over ? 'over' : ''}`}>{usageLine(status.config.usage, month, status.config.provider)}{over && ' · over your monthly limit'}</p>
      <p className="quiet ai-billing">Paid usage is billed by the provider on this API key, separately from any subscription. A local model means nothing leaves this computer (except pages you fetch). Cloud providers receive the topic and source text you send.</p>
    </>}
    {problem && <p className="research-problem" role="alert">{problem}</p>}
    {note && <p className="ai-note" role="status">{note}</p>}
    <div className="ai-actions"><button type="button" className="outline-button" disabled={working || saved} onClick={() => void save()}>Save AI settings</button>{form.enabled && <button type="button" className="outline-button" disabled={working || !saved || !hasKey && !keyOptional} title={!saved ? 'Save the AI settings first' : undefined} onClick={() => void run(() => ai.test())}>{working ? 'Checking…' : 'Test connection'}</button>}</div>
  </section>
}
