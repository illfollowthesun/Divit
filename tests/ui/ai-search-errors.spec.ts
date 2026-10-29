import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { newProject } from '../../src/shared/types'
import { desktopBridge, nativeCalls } from './desktop-bridge'

const quota = '[no-search-quota] This Gemini key has no quota for web search. Its free tier probably includes no Google Search quota. Turn on billing for the key, choose another provider in Settings → AI, or ask without web search.'
const usage = { inputTokens: 120, outputTokens: 300, webSearches: 0, costUsd: 0.0012, monthCostUsd: 0.0012, overLimit: false, model: 'gemini-3.8-flash' }

async function searchFails(page: import('@playwright/test').Page, searchError: string) {
  await desktopBridge(page, { config: { enabled: true }, keys: { gemini: true }, searchError, answer: { answer: 'Ferries have run across the Bosphorus since 1851.\n- Look for: city archives', usage }, projects: [{ ...newProject('Ferry notes'), id: randomUUID(), mode: 'normal' }] })
  await page.goto('/')
  await page.getByRole('button', { name: /Ferry notes/ }).click()
  await page.getByRole('button', { name: /^Research/ }).click()
  const drawer = page.getByRole('complementary', { name: 'Research' })
  await drawer.getByRole('button', { name: 'Search about this topic' }).click()
  await drawer.getByLabel('Topic', { exact: true }).fill('Bosphorus ferries')
  await drawer.getByRole('button', { name: 'Search with AI' }).click()
  return drawer
}

test('a Gemini key without search quota explains why and offers an unsourced answer', async ({ page }) => {
  const drawer = await searchFails(page, quota)
  await expect(drawer.getByRole('alert')).toHaveText(quota.slice('[no-search-quota] '.length))
  await expect(drawer.getByRole('button', { name: 'Turn on billing ↗' })).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'Choose another provider' })).toBeVisible()
  await drawer.getByRole('button', { name: 'Ask without web search' }).click()
  const answer = drawer.getByRole('region', { name: 'Answer without web search' })
  await expect(answer).toContainText('AI · unsourced')
  await expect(answer).toContainText('No web search was used')
  await expect(answer).toContainText('Ferries have run across the Bosphorus since 1851.')
  expect((await nativeCalls(page)).find(c => c.cmd === 'ai_ask_unsourced')?.args.request).toMatchObject({ topic: 'Bosphorus ferries' })
  await answer.getByRole('button', { name: 'Save to Notes' }).click()
  await expect(answer.getByText('Saved to Notes')).toBeVisible()
  await answer.getByRole('button', { name: 'Done' }).click()
  await drawer.getByRole('tab', { name: 'Notes' }).click()
  await expect(drawer).toContainText('Unsourced AI answer: Bosphorus ferries')
})

test('a Gemini billing error links to AI Studio billing and offers no unsourced answer', async ({ page }) => {
  const drawer = await searchFails(page, "[billing] Billing on this key's Google project is not active yet. Turn it on in Google AI Studio, then try again.")
  await expect(drawer.getByRole('alert')).toHaveText("Billing on this key's Google project is not active yet. Turn it on in Google AI Studio, then try again.")
  await expect(drawer.getByRole('button', { name: 'Open AI Studio billing ↗' })).toBeVisible()
  await expect(drawer.getByRole('button', { name: 'Ask without web search' })).toHaveCount(0)
})
