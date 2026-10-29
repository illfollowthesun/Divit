import { invoke } from '@tauri-apps/api/core'
import { desktop } from '../shared/api'

// Mirrors src-tauri/src/ai.rs. The key itself never comes back from the native side.
export type AiProvider = 'gemini' | 'local' | 'anthropic' | 'openai' | 'openai-compatible'
export type AiUsage = { month: string; calls: number; inputTokens: number; outputTokens: number; webSearches: number; costUsd: number; unpricedCalls: number }
export type AiConfig = { enabled: boolean; provider: AiProvider; model: string; baseUrl: string; monthlyLimitUsd: number | null; fallbacks: boolean; usage: AiUsage }
export type AiModel = { id: string; label: string; inputPerMtok: number; outputPerMtok: number; fallbacks: boolean; fromMonth?: [string, number, number] | null }
export type AiCapabilities = { nativeSearch: boolean; deepResearch: boolean; streaming: boolean; local: boolean; keyRequired: boolean }
export type AiStatus = { config: AiConfig; capabilities: AiCapabilities; hasKey: Record<AiProvider, boolean>; models: { gemini: AiModel[]; anthropic: AiModel[] }; price: AiModel | null }
export type AiCandidate = { title: string; url: string; site: string; published: string; type: 'news' | 'article' | 'blog' | 'paper' | 'other'; summary: string; excerpt: string }
export type AiSpend = { inputTokens: number; outputTokens: number; webSearches: number; costUsd: number | null; monthCostUsd: number; overLimit: boolean; model: string }
export type AiSearchResult = { candidates: AiCandidate[]; dropped: number; usage: AiSpend }

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
const needsDesktop = () => Promise.reject(new Error('AI runs from the desktop app.'))
export const ai = {
  status: (): Promise<AiStatus> => desktop ? invoke('ai_status') : needsDesktop(),
  save: (config: AiConfig): Promise<AiStatus> => desktop ? invoke('ai_save', { config }) : needsDesktop(),
  setKey: (provider: AiProvider, key: string): Promise<void> => desktop ? invoke('ai_set_key', { provider, key }) : needsDesktop(),
  forgetKey: (provider: AiProvider): Promise<void> => desktop ? invoke('ai_forget_key', { provider }) : needsDesktop(),
  test: (): Promise<string> => desktop ? invoke('ai_test') : needsDesktop(),
  search: (request: { topic: string; angle: string; language: 'en' | 'tr'; count: number; projectTitle: string; month: string }): Promise<AiSearchResult> => desktop ? invoke('ai_search', { request }) : needsDesktop(),
}
export const money = (usd: number) => `$${usd < 0.01 ? usd.toFixed(4) : usd.toFixed(2)}`
// Gemini prices are paid-tier list prices; a free-tier key is not charged for tokens.
export const costNote = (provider: AiProvider) => provider === 'gemini' ? ' if billed (free-tier keys are not charged; search charges excluded)' : ''
export const usageLine = (usage: AiUsage, month: string, provider: AiProvider) => {
  if (usage.month !== month || !usage.calls) return 'No AI requests this month.'
  const cost = usage.costUsd > 0 ? ` · about ${money(usage.costUsd)}${costNote(provider)}` : ''
  const searches = usage.webSearches ? ` · ${usage.webSearches} web ${usage.webSearches === 1 ? 'search' : 'searches'}` : ''
  const unpriced = usage.unpricedCalls ? ` (${usage.unpricedCalls} without a known price)` : ''
  return `This month: ${usage.calls} ${usage.calls === 1 ? 'request' : 'requests'} · ${usage.inputTokens.toLocaleString()} in / ${usage.outputTokens.toLocaleString()} out tokens${searches}${cost}${unpriced}`
}
