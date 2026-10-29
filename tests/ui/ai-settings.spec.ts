import { test, expect } from '@playwright/test'
import { desktopBridge, nativeCalls } from './desktop-bridge'

test('Gemini model labels follow the published January price change', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2027-01-15T12:00:00Z'))
  await desktopBridge(page, { config: { enabled: true } })
  await page.goto('/'); await page.getByRole('button', { name: 'Open settings' }).click()
  const model = page.getByRole('dialog').getByLabel('Model', { exact: true })
  await expect(model.locator('option').first()).toHaveText('Gemini 3.8 Flash · $1.5 / $7.5 per million tokens in / out on paid keys')
})

test('in the browser preview, AI settings only explain that AI runs from the desktop app', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Open settings' }).click()
  const section = page.getByRole('dialog').locator('.ai-settings')
  const apiKey = section.locator('.ai-key').getByLabel('API key', { exact: true })
  await expect(section).toContainText('AI features run from the desktop app')
  await expect(apiKey).toHaveCount(0)
})

test('Gemini comes first, then local models; keys go only to Credential Manager; Claude fallbacks are an opt-in', async ({ page }) => {
  const month = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 7)
  await desktopBridge(page, { config: { usage: { month, calls: 3, inputTokens: 12000, outputTokens: 800, webSearches: 2, costUsd: 0.064, unpricedCalls: 0 } }, testMessage: 'Connected. Gemini 3.8 Flash is available.' })
  await page.goto('/'); await page.getByRole('button', { name: 'Open settings' }).click()
  const section = page.getByRole('dialog').locator('.ai-settings')
  const apiKey = section.locator('.ai-key').getByLabel('API key', { exact: true })
  await expect(section.getByLabel('Use AI in Yazı')).not.toBeChecked()
  await expect(apiKey).toHaveCount(0) // hidden while AI is off
  await expect(section).toContainText('subscriptions cannot be used here')
  await section.getByLabel('Use AI in Yazı').check()

  const provider = section.getByLabel('Provider')
  await expect(provider.locator('option')).toHaveText(['Google Gemini (free tier, easiest)', 'Local model: Ollama or LM Studio (free, private)', 'Anthropic (Claude)', 'OpenAI', 'Other OpenAI-compatible service'])
  const model = section.getByLabel('Model', { exact: true })
  await expect(provider).toHaveValue('gemini'); await expect(model).toHaveValue('gemini-3.8-flash')
  await expect(section).toContainText('aistudio.google.com'); await expect(section).toContainText('searching the web needs a paid key')
  await expect(section.locator('.ai-usage')).toHaveText('This month: 3 requests · 12,000 in / 800 out tokens · 2 web searches · about $0.06 if billed (free-tier keys are not charged; search charges excluded)')
  await expect(section.getByRole('button', { name: 'Test connection' })).toBeDisabled()

  const secret = 'AIzaSy-test-0123456789'
  await apiKey.fill(secret); await section.getByRole('button', { name: 'Store key' }).click()
  await expect(section.getByRole('status')).toHaveText('Key stored in Windows Credential Manager.')
  await expect(apiKey).toHaveValue(''); await expect(section).toContainText('A key is stored in Windows Credential Manager.')
  await section.getByRole('button', { name: 'Save AI settings' }).click(); await expect(section.getByRole('status')).toHaveText('AI settings saved.')
  await section.getByRole('button', { name: 'Test connection' }).click()
  await expect(section.getByRole('status')).toHaveText('Connected. Gemini 3.8 Flash is available.')

  await provider.selectOption('local')
  await expect(section.getByLabel('Service address')).toHaveValue('http://localhost:11434/v1')
  await expect(section).toContainText('nothing you send leaves it'); await expect(section).toContainText('usually not needed for a local model')

  await provider.selectOption('anthropic')
  await expect(model).toHaveValue('claude-sonnet-5-5')
  await expect(model.locator('option')).toHaveText(['Claude Sonnet 5.5 · $2 / $10 per million tokens in / out', 'Claude Haiku 5.5 (lowest cost) · $0.1 / $0.5 per million tokens in / out', 'Claude Opus 5.5 · $4 / $20 per million tokens in / out'])
  const fallbacks = section.getByLabel(/retry it on Anthropic's recommended fallback model/)
  await expect(fallbacks).not.toBeChecked(); await expect(fallbacks).toBeEnabled()
  await fallbacks.check(); await model.selectOption('claude-haiku-5-5')
  await expect(fallbacks).not.toBeChecked(); await expect(fallbacks).toBeDisabled(); await expect(section).toContainText('(not available for this model)')
  await model.selectOption('claude-sonnet-5-5'); await fallbacks.check(); await section.getByLabel('Monthly soft limit (USD)').fill('5')
  await section.getByRole('button', { name: 'Save AI settings' }).click(); await expect(section.getByRole('status')).toHaveText('AI settings saved.')

  const calls = await nativeCalls(page)
  expect(calls.filter(call => JSON.stringify(call.args).includes(secret)).map(call => call.cmd)).toEqual(['ai_set_key'])
  const saved = calls.filter(call => call.cmd === 'ai_save').map(call => call.args.config as Record<string, unknown>)
  expect(saved.map(c => [c.provider, c.model, c.fallbacks, c.monthlyLimitUsd])).toEqual([['gemini', 'gemini-3.8-flash', false, null], ['anthropic', 'claude-sonnet-5-5', true, 5]])
  expect(await page.evaluate(secret => document.documentElement.outerHTML.includes(secret) || JSON.stringify(localStorage).includes(secret), secret)).toBe(false)
})
