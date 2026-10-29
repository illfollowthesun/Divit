import type { Page } from '@playwright/test'

// Stands in for the Tauri bridge so desktop-only screens can be exercised in the browser. AI calls are
// answered from `options`; research calls go to the dev server's real research bridge, so pages are
// really fetched and saved. Every native call is recorded on window.__calls.
export type BridgeOptions = {
  config: Record<string, unknown>; keys?: Record<string, boolean>; projects?: Record<string, unknown>[]
  search?: unknown; searchError?: string; testMessage?: string; answer?: unknown; searchKeys?: Record<string, boolean>; update?: unknown; extra?: Record<string, unknown>
}
export async function desktopBridge(page: Page, options: BridgeOptions) {
  await page.addInitScript((options: BridgeOptions) => {
    const w = window as unknown as Record<string, unknown>, calls: { cmd: string; args: Record<string, unknown> }[] = []
    const month = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 7)
    let config = { enabled: false, provider: 'gemini', model: 'gemini-3.8-flash', baseUrl: '', monthlyLimitUsd: null, fallbacks: false, usage: { month, calls: 0, inputTokens: 0, outputTokens: 0, webSearches: 0, costUsd: 0, unpricedCalls: 0 }, search: { provider: 'none', searxngUrl: '', always: false }, ...options.config } as Record<string, unknown>
    const searchKeys: Record<string, boolean> = { tavily: false, brave: false, ...options.searchKeys }
    const keys: Record<string, boolean> = { gemini: false, local: false, anthropic: false, openai: false, 'openai-compatible': false, ...options.keys }
    const models = {
      gemini: [{ id: 'gemini-3.8-flash', label: 'Gemini 3.8 Flash', inputPerMtok: 0.75, outputPerMtok: 3.75, fromMonth: ['2027-01', 1.5, 7.5], fallbacks: false }, { id: 'gemini-3.5-flash-lite', label: 'Gemini 3.5 Flash-Lite (lowest cost)', inputPerMtok: 0.3, outputPerMtok: 2.5, fallbacks: false }],
      anthropic: [{ id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', inputPerMtok: 2, outputPerMtok: 10, fallbacks: true }, { id: 'claude-haiku-5-5', label: 'Claude Haiku 5.5 (lowest cost)', inputPerMtok: 0.1, outputPerMtok: 0.5, fallbacks: false }, { id: 'claude-opus-5-5', label: 'Claude Opus 5.5', inputPerMtok: 4, outputPerMtok: 20, fallbacks: true }],
    }
    const status = () => {
      const provider = config.provider as string, list = (models as Record<string, { id: string }[]>)[provider] ?? []
      const search = config.search as { provider: string; searxngUrl: string }
      return { config, hasKey: { ...keys }, models, price: list.find(m => m.id === config.model) ?? null,
        hasSearchKey: { ...searchKeys }, searchReady: search.provider === 'searxng' ? !!search.searxngUrl : !!searchKeys[search.provider],
        capabilities: { nativeSearch: ['gemini', 'anthropic'].includes(provider), deepResearch: false, streaming: true, local: provider === 'local', keyRequired: provider !== 'local' } }
    }
    const library = { projects: options.projects ?? [], ideas: [], images: [], trash: [], dataRoot: 'C:/Users/writer/Documents/Yazi', settings: { schemaVersion: 1, theme: 'light', siteRepo: '', aiProvider: 'claude-code' } }
    w.__calls = calls; w.isTauri = true
    w.__TAURI_INTERNALS__ = {
      transformCallback: () => Math.floor(Math.random() * 1e9), unregisterCallback: () => {}, convertFileSrc: (p: string) => p,
      invoke: async (cmd: string, args: Record<string, unknown> = {}) => {
        calls.push({ cmd, args: JSON.parse(JSON.stringify(args)) })
        switch (cmd) {
          case 'library': return library
          case 'save_project': return { ...(args.data as object), revision: `r${Date.now()}` }
          case 'ai_status': return status()
          case 'ai_save': config = { ...(args.config as object), usage: config.usage }; return status()
          case 'ai_set_key': keys[args.provider as string] = true; return null
          case 'ai_forget_key': keys[args.provider as string] = false; return null
          case 'search_set_key': searchKeys[args.service as string] = true; return null
          case 'search_forget_key': searchKeys[args.service as string] = false; return null
          case 'ai_test': return options.testMessage ?? 'Connected.'
          case 'ai_search': if (options.searchError) throw options.searchError; return options.search
          case 'ai_ask_unsourced': return options.answer
          case 'research_action': {
            const response = await fetch('/__yazi/research', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Yazi-Preview': '1' }, body: JSON.stringify({ ...(args.payload as object), projectId: args.projectId, action: args.action }) })
            const result = await response.json(); if (!response.ok) throw result.error; return result
          }
          case 'backup_action': return { enabled: false, lastBackupAt: null }
          case 'plugin:app|version': return '0.1.0-beta.1'
          case 'plugin:updater|check': return options.update ?? null
          default: return options.extra?.[cmd] ?? null
        }
      },
    }
  }, options)
}
export const nativeCalls = (page: Page): Promise<{ cmd: string; args: Record<string, unknown> }[]> => page.evaluate(() => (window as unknown as { __calls: never }).__calls)
