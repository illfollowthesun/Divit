import { invoke } from '@tauri-apps/api/core'
import { desktop } from '../shared/api'

// Mirrors src-tauri/src/ai.rs. The key itself never comes back from the native side.
export type AiProvider = 'anthropic' | 'openai' | 'openai-compatible'
export type AiUsage = { month: string; calls: number; inputTokens: number; outputTokens: number; costUsd: number; unpricedCalls: number }
export type AiConfig = { enabled: boolean; provider: AiProvider; model: string; baseUrl: string; monthlyLimitUsd: number | null; usage: AiUsage }
export type AiModel = { id: string; label: string; inputPerMtok: number; outputPerMtok: number }
export type AiStatus = { config: AiConfig; capabilities: { nativeSearch: boolean; deepResearch: boolean; streaming: boolean; local: boolean }; hasKey: Record<AiProvider, boolean>; models: AiModel[]; price: AiModel | null }

// Presets only fill in the address; any OpenAI-compatible service works with its own URL.
export const compatiblePresets = [
  { label: 'Ollama (this computer)', url: 'http://localhost:11434/v1' },
  { label: 'LM Studio (this computer)', url: 'http://localhost:1234/v1' },
  { label: 'DeepSeek', url: 'https://api.deepseek.com/v1' },
  { label: 'Kimi (Moonshot)', url: 'https://api.moonshot.ai/v1' },
  { label: 'OpenRouter', url: 'https://openrouter.ai/api/v1' },
  { label: 'Groq', url: 'https://api.groq.com/openai/v1' },
]
const needsDesktop = () => Promise.reject(new Error('AI runs from the desktop app.'))
export const ai = {
  status: (): Promise<AiStatus> => desktop ? invoke('ai_status') : needsDesktop(),
  save: (config: AiConfig): Promise<AiStatus> => desktop ? invoke('ai_save', { config }) : needsDesktop(),
  setKey: (provider: AiProvider, key: string): Promise<void> => desktop ? invoke('ai_set_key', { provider, key }) : needsDesktop(),
  forgetKey: (provider: AiProvider): Promise<void> => desktop ? invoke('ai_forget_key', { provider }) : needsDesktop(),
  test: (): Promise<string> => desktop ? invoke('ai_test') : needsDesktop(),
}
export const usageLine = (usage: AiUsage, month: string) => {
  if (usage.month !== month || !usage.calls) return 'No AI requests this month.'
  const cost = usage.costUsd > 0 ? ` · about $${usage.costUsd < 0.01 ? usage.costUsd.toFixed(4) : usage.costUsd.toFixed(2)}` : ''
  const unpriced = usage.unpricedCalls ? ` (${usage.unpricedCalls} without a known price)` : ''
  return `This month: ${usage.calls} ${usage.calls === 1 ? 'request' : 'requests'} · ${usage.inputTokens.toLocaleString()} in / ${usage.outputTokens.toLocaleString()} out tokens${cost}${unpriced}`
}
