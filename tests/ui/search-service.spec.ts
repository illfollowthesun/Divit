import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { newProject } from '../../src/shared/types'
import { desktopBridge, nativeCalls } from './desktop-bridge'

const usage = { inputTokens: 900, outputTokens: 120, webSearches: 0, costUsd: null, monthCostUsd: 0, overLimit: false, model: 'llama3.2' }
const candidate = { title: 'Winter timetable', url: 'https://example.com/tarife', site: 'example.com', published: '2026-10-20', type: 'news', summary: 'The first ferry leaves at 06:10.', excerpt: '' }
const local = { enabled: true, provider: 'local', model: 'llama3.2', baseUrl: 'http://localhost:11434/v1' }
async function search(page: Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /Ferry notes/ }).click()
  await page.getByRole('button', { name: /^Research/ }).click()
  const drawer = page.getByRole('complementary', { name: 'Research' })
  await drawer.getByRole('button', { name: 'Search about this topic' }).click()
  await drawer.getByLabel('Topic', { exact: true }).fill('Winter ferries')
  return drawer
}

test('Settings stores a search service key only in Credential Manager and saves the choice', async ({ page }) => {
  await desktopBridge(page, { config: local })
  await page.goto('/'); await page.getByRole('button', { name: 'Open settings' }).click()
  const section = page.getByRole('dialog').locator('.ai-settings')
  const service = section.getByLabel('Search service', { exact: true })
  await expect(service.locator('option')).toHaveText(['None', 'Tavily (free monthly allowance)', 'Brave Search', 'SearXNG (your own server)'])
  await service.selectOption('tavily')
  await expect(section).toContainText('your AI model ranks and summarises them')
  const secret = 'tvly-test-0123456789'
  await section.getByLabel('Search service key').fill(secret)
  await section.getByRole('button', { name: 'Store search key' }).click()
  await expect(section.getByRole('status')).toHaveText('Search key stored in Windows Credential Manager.')
  await expect(section.getByRole('button', { name: 'Remove search key' })).toBeVisible()
  await service.selectOption('searxng'); await section.getByLabel('SearXNG address').fill('http://localhost:8080')
  await service.selectOption('tavily')
  await section.getByRole('button', { name: 'Save AI settings' }).click()
  await expect(section.getByRole('status')).toHaveText('AI settings saved.')
  const calls = await nativeCalls(page)
  expect(calls.filter(c => JSON.stringify(c.args).includes(secret)).map(c => c.cmd)).toEqual(['search_set_key'])
  expect(calls.filter(c => c.cmd === 'ai_save').map(c => (c.args.config as { search: unknown }).search)).toEqual([{ provider: 'tavily', searxngUrl: 'http://localhost:8080', always: false }])
  expect(await page.evaluate(secret => document.documentElement.outerHTML.includes(secret), secret)).toBe(false)
})

test('a local model with Tavily can search; results say which service found them', async ({ page }) => {
  await desktopBridge(page, { config: { ...local, search: { provider: 'tavily', searxngUrl: '', always: false } }, searchKeys: { tavily: true }, search: { candidates: [candidate], dropped: 0, via: 'Tavily', ranked: true, usage }, projects: [{ ...newProject('Ferry notes'), id: randomUUID(), mode: 'normal' }] })
  const drawer = await search(page)
  await expect(drawer).toContainText('Tavily finds the pages; llama3.2 ranks and summarises them.')
  await drawer.getByRole('button', { name: 'Search with AI' }).click()
  const found = drawer.getByLabel('Sources found by AI')
  await expect(found.locator('.search-via')).toHaveText('Found with Tavily; ranked and summarised by llama3.2.')
  await expect(found.locator('.ai-candidate .source-kind .ai-label')).toHaveText('Tavily')
  await expect(found).toContainText('The first ferry leaves at 06:10.')
})

test('unranked service results say the snippets are not AI', async ({ page }) => {
  await desktopBridge(page, { config: { ...local, search: { provider: 'searxng', searxngUrl: 'http://localhost:8080', always: false } }, search: { candidates: [{ ...candidate, summary: '', excerpt: 'Kış tarifesi: ilk vapur 06:10.' }], dropped: 0, via: 'SearXNG', ranked: false, rankProblem: 'llama3.2 did not answer in the expected form.', usage }, projects: [{ ...newProject('Ferry notes'), id: randomUUID(), mode: 'normal' }] })
  const drawer = await search(page)
  await drawer.getByRole('button', { name: 'Search with AI' }).click()
  await expect(drawer.locator('.search-via')).toHaveText("Found with SearXNG, in its own order. llama3.2 did not answer in the expected form. The text under each page is SearXNG's snippet, not AI.")
  await expect(drawer.locator('.ai-excerpt')).toHaveText('Kış tarifesi: ilk vapur 06:10.')
})
