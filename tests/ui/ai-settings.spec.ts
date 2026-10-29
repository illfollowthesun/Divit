import { test, expect } from '@playwright/test'

test('in the browser preview, AI settings only explain that AI runs from the desktop app', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Open settings' }).click()
  const section = page.getByRole('dialog').locator('.ai-settings')
  await expect(section).toContainText('AI features run from the desktop app')
  await expect(section.getByLabel('API key')).toHaveCount(0)
})

// Stands in for the Tauri bridge so the desktop form can be exercised: it records every native call.
test('desktop AI settings send the key only to Credential Manager and never keep it in the form', async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as Record<string, unknown>, calls: { cmd: string; args: Record<string, unknown> }[] = []
    let config = { enabled: false, provider: 'anthropic', model: 'claude-opus-5-5', baseUrl: '', monthlyLimitUsd: null as number | null, usage: { month: new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 7), calls: 3, inputTokens: 12000, outputTokens: 800, costUsd: 0.064, unpricedCalls: 0 } }
    const keys: Record<string, boolean> = { anthropic: false, openai: false, 'openai-compatible': false }
    const models = [{ id: 'claude-opus-5-5', label: 'Claude Opus 5.5', inputPerMtok: 4, outputPerMtok: 20 }, { id: 'claude-sonnet-5-5', label: 'Claude Sonnet 5.5', inputPerMtok: 2, outputPerMtok: 10 }]
    const status = () => ({ config, capabilities: { nativeSearch: true, deepResearch: false, streaming: true, local: false }, hasKey: { ...keys }, models, price: models[0] })
    const library = { projects: [], ideas: [], images: [], trash: [], dataRoot: 'C:/Users/writer/Documents/Yazi', settings: { schemaVersion: 1, theme: 'light', siteRepo: '', aiProvider: 'claude-code' } }
    w.__aiCalls = calls; w.isTauri = true
    w.__TAURI_INTERNALS__ = {
      transformCallback: () => Math.floor(Math.random() * 1e9), unregisterCallback: () => {}, convertFileSrc: (p: string) => p,
      invoke: async (cmd: string, args: Record<string, unknown> = {}) => {
        calls.push({ cmd, args: JSON.parse(JSON.stringify(args)) })
        if (cmd === 'library') return library
        if (cmd === 'ai_status') return status()
        if (cmd === 'ai_save') { config = { ...(args.config as typeof config), usage: config.usage }; return status() }
        if (cmd === 'ai_set_key') { keys[args.provider as string] = true; return null }
        if (cmd === 'ai_forget_key') { keys[args.provider as string] = false; return null }
        if (cmd === 'ai_test') return 'Connected. Claude Opus 5.5 is available.'
        if (cmd === 'backup_action') return { enabled: false, lastBackupAt: null }
        return null
      },
    }
  })
  await page.goto('/'); await page.getByRole('button', { name: 'Open settings' }).click()
  const section = page.getByRole('dialog').locator('.ai-settings')
  await expect(section.getByLabel('Use AI in Yazı')).not.toBeChecked()
  await expect(section.getByLabel('API key')).toHaveCount(0) // hidden while AI is off
  await section.getByLabel('Use AI in Yazı').check()
  await expect(section.getByLabel('Provider')).toHaveValue('anthropic')
  await expect(section.getByLabel('Model')).toHaveValue('claude-opus-5-5')
  await expect(section.getByLabel('Model').locator('option').first()).toHaveText('Claude Opus 5.5 · $4 / $20 per million tokens in / out')
  await expect(section.getByRole('button', { name: 'Test connection' })).toBeDisabled()

  const secret = 'sk-ant-test-0123456789'
  await section.getByLabel('API key').fill(secret); await section.getByRole('button', { name: 'Store key' }).click()
  await expect(section.getByRole('status')).toHaveText('Key stored in Windows Credential Manager.')
  await expect(section.getByLabel('API key')).toHaveValue('')
  await expect(section).toContainText('A key is stored in Windows Credential Manager.')

  await section.getByLabel('Model').selectOption('claude-sonnet-5-5'); await section.getByLabel('Monthly soft limit (USD)').fill('5')
  await section.getByRole('button', { name: 'Save AI settings' }).click()
  await expect(section.getByRole('status')).toHaveText('AI settings saved.')
  await section.getByRole('button', { name: 'Test connection' }).click()
  await expect(section.getByRole('status')).toHaveText('Connected. Claude Opus 5.5 is available.')
  await expect(section.locator('.ai-usage')).toHaveText('This month: 3 requests · 12,000 in / 800 out tokens · about $0.06')
  await expect(section).toContainText('separately from any Claude or ChatGPT subscription')

  await section.getByLabel('Provider').selectOption('openai-compatible')
  await expect(section.getByLabel('Service address')).toBeVisible(); await expect(section.getByLabel('Model')).toHaveValue('')

  const calls: { cmd: string; args: Record<string, unknown> }[] = await page.evaluate(() => (window as unknown as { __aiCalls: never }).__aiCalls)
  const withSecret = calls.filter(call => JSON.stringify(call.args).includes(secret)).map(call => call.cmd)
  expect(withSecret).toEqual(['ai_set_key'])
  const saved = calls.find(call => call.cmd === 'ai_save')!.args.config as Record<string, unknown>
  expect([saved.enabled, saved.provider, saved.model, saved.monthlyLimitUsd]).toEqual([true, 'anthropic', 'claude-sonnet-5-5', 5])
  expect(await page.evaluate(secret => document.documentElement.outerHTML.includes(secret) || JSON.stringify(localStorage).includes(secret), secret)).toBe(false)
})
