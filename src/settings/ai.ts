import { invoke } from '@tauri-apps/api/core'
import { desktop } from '../shared/api'
import { t, tn } from '../i18n'

// Mirrors src-tauri/src/ai.rs. The key itself never comes back from the native side.
export type AiProvider = 'gemini' | 'local' | 'anthropic' | 'openai' | 'openai-compatible'
export type AiUsage = { month: string; calls: number; inputTokens: number; outputTokens: number; webSearches: number; costUsd: number; unpricedCalls: number }
export type SearchService = 'none' | 'tavily' | 'brave' | 'searxng'
export type SearchConfig = { provider: SearchService; searxngUrl: string; always: boolean }
export type AiConfig = { enabled: boolean; provider: AiProvider; model: string; baseUrl: string; monthlyLimitUsd: number | null; fallbacks: boolean; usage: AiUsage; search: SearchConfig; legacyProvider?: string }
export type AiModel = { id: string; label: string; inputPerMtok: number; outputPerMtok: number; fallbacks: boolean; fromMonth?: [string, number, number] | null }
export type AiCapabilities = { nativeSearch: boolean; deepResearch: boolean; streaming: boolean; local: boolean; keyRequired: boolean }
export type AiStatus = { config: AiConfig; capabilities: AiCapabilities; hasKey: Record<AiProvider, boolean>; hasSearchKey: { tavily: boolean; brave: boolean }; searchReady: boolean; models: { gemini: AiModel[]; anthropic: AiModel[] }; price: AiModel | null }
export type AiCandidate = { title: string; url: string; site: string; published: string; type: 'news' | 'article' | 'blog' | 'paper' | 'other'; summary: string; excerpt: string }
export type AiSpend = { inputTokens: number; outputTokens: number; webSearches: number; costUsd: number | null; monthCostUsd: number; overLimit: boolean; model: string }
// `via` names the search service when one found the results; `ranked` is false if the model could not order them.
export type AiSearchResult = { candidates: AiCandidate[]; dropped: number; usage: AiSpend; via?: string; ranked?: boolean; rankProblem?: string | null }
export type AiAnswer = { answer: string; usage: AiSpend }
export type AiRequest = { topic: string; angle: string; language: 'en' | 'tr'; count: number; projectTitle: string; month: string; via?: 'service' }
// Native errors the panel can act on start with "[code] ". The code picks the offered next step.
export function aiError(error: unknown) {
  const text = error instanceof Error ? error.message : String(error), code = /^\[([a-z-]+)\] /.exec(text)
  return code ? { code: code[1], text: text.slice(code[0].length) } : { code: '', text }
}
export const AI_STUDIO_BILLING = 'https://aistudio.google.com/apikey'

// Free and private options first: no subscription can be used, only an API key or a local model.
export const providers: { id: AiProvider; label: string; note: string }[] = [
  { id: 'gemini', label: 'Google Gemini (free tier, easiest)', note: 'Get a free API key at aistudio.google.com. The free tier covers summaries, questions and angles; searching the web needs a paid key. It includes 5,000 free searches a month shared across Gemini 3 and newer models, then $14 per 1,000 search queries. On the free tier Google may use what you send to improve its products.' },
  { id: 'local', label: 'Local model: Ollama or LM Studio (free, private)', note: 'Runs on this computer; nothing you send leaves it. Small models are fine for summaries, questions and angles, but cannot search the web.' },
  { id: 'anthropic', label: 'Anthropic (Claude)', note: 'Needs an API key from console.anthropic.com; usage is billed to it.' },
  { id: 'openai', label: 'OpenAI', note: 'Needs an API key from platform.openai.com; usage is billed to it.' },
  { id: 'openai-compatible', label: 'Other OpenAI-compatible service', note: 'Kimi, DeepSeek, OpenRouter, Groq and others, with their own API key and address.' },
]
// Presets only fill in the address; check it in the service's documentation.
export const localPresets = [{ label: 'Ollama', url: 'http://localhost:11434/v1' }, { label: 'LM Studio', url: 'http://localhost:1234/v1' }]
export const compatiblePresets = [
  { label: 'DeepSeek', url: 'https://api.deepseek.com/v1' }, { label: 'Kimi (Moonshot)', url: 'https://api.moonshot.ai/v1' },
  { label: 'OpenRouter', url: 'https://openrouter.ai/api/v1' }, { label: 'Groq', url: 'https://api.groq.com/openai/v1' },
]
// Search without a paid AI: one of these finds pages, the selected model ranks and summarises them.
export const searchServices: { id: SearchService; label: string; note: string }[] = [
  { id: 'none', label: 'None', note: 'Only Gemini (with billing) and Claude can search the web themselves.' },
  { id: 'tavily', label: 'Tavily (free monthly allowance)', note: 'Get a key at tavily.com. The free plan includes about 1,000 searches a month.' },
  { id: 'brave', label: 'Brave Search', note: 'Get a key at brave.com/search/api. New accounts get a monthly credit worth about 1,000 searches; check its current plans.' },
  { id: 'searxng', label: 'SearXNG (your own server)', note: 'A search engine you run yourself. Turn on the JSON format in its settings.yml.' },
]
export const noSearch: SearchConfig = { provider: 'none', searxngUrl: '', always: false }
// Older native builds and test bridges may leave out the search fields.
const filled = (status: AiStatus): AiStatus => ({ ...status, config: { ...status.config, search: status.config.search ?? noSearch }, hasSearchKey: status.hasSearchKey ?? { tavily: false, brave: false }, searchReady: !!status.searchReady })
// Whether a search can start now, and how: the model's own web search or the search service.
export function searchRoute(status: AiStatus | null): 'native' | 'service' | null {
  const config = status?.config
  if (!status || !config?.enabled) return null
  const modelReady = !status.capabilities.keyRequired || status.hasKey[config.provider]
  if (!modelReady) return null
  if (status.capabilities.nativeSearch && !config.search.always) return 'native'
  return status.searchReady ? 'service' : null
}
export const serviceLabel = (status: AiStatus | null) => t(searchServices.find(s => s.id === status?.config.search.provider)?.label ?? '').replace(/ \(.*\)$/, '')
const needsDesktop = () => Promise.reject(new Error(t('AI runs from the desktop app.')))
export const ai = {
  status: (): Promise<AiStatus> => desktop ? invoke<AiStatus>('ai_status').then(filled) : needsDesktop(),
  save: (config: AiConfig): Promise<AiStatus> => desktop ? invoke<AiStatus>('ai_save', { config }).then(filled) : needsDesktop(),
  setSearchKey: (service: SearchService, key: string): Promise<void> => desktop ? invoke('search_set_key', { service, key }) : needsDesktop(),
  forgetSearchKey: (service: SearchService): Promise<void> => desktop ? invoke('search_forget_key', { service }) : needsDesktop(),
  setKey: (provider: AiProvider, key: string): Promise<void> => desktop ? invoke('ai_set_key', { provider, key }) : needsDesktop(),
  forgetKey: (provider: AiProvider): Promise<void> => desktop ? invoke('ai_forget_key', { provider }) : needsDesktop(),
  test: (): Promise<string> => desktop ? invoke('ai_test') : needsDesktop(),
  search: (request: AiRequest): Promise<AiSearchResult> => desktop ? invoke('ai_search', { request }) : needsDesktop(),
  askUnsourced: (request: AiRequest): Promise<AiAnswer> => desktop ? invoke('ai_ask_unsourced', { request }) : needsDesktop(),
}
export const money = (usd: number) => `$${usd < 0.01 ? usd.toFixed(4) : usd.toFixed(2)}`
// Gemini prices are paid-tier list prices; a free-tier key is not charged for tokens.
export const costNote = (provider: AiProvider) => provider === 'gemini' ? ` ${t('if billed (free-tier keys are not charged; search charges excluded)')}` : ''
export const usageLine = (usage: AiUsage, month: string, provider: AiProvider) => {
  if (usage.month !== month || !usage.calls) return t('No AI requests this month.')
  const cost = usage.costUsd > 0 ? ` · ${t('about {cost}', { cost: money(usage.costUsd) })}${costNote(provider)}` : ''
  const searches = usage.webSearches ? ` · ${tn(usage.webSearches, '{n} web search', '{n} web searches')}` : ''
  const unpriced = usage.unpricedCalls ? ` ${t('({n} without a known price)', { n: usage.unpricedCalls })}` : ''
  return `${t('This month:')} ${tn(usage.calls, '{n} request', '{n} requests')} · ${t('{input} in / {output} out tokens', { input: usage.inputTokens, output: usage.outputTokens })}${searches}${cost}${unpriced}`
}
