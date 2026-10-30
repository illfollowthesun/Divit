import { test, expect } from '@playwright/test'
import { settingsTab } from './shell-helpers'
import { randomUUID } from 'node:crypto'
import { desktopBridge, nativeCalls } from './desktop-bridge'
import { newProject } from '../../src/shared/types'

const found = {
  candidates: [{ title: 'Candidate from A', url: 'https://example.com/only-project-a', site: 'Example', published: '', type: 'other', summary: 'Summary belonging to A.', excerpt: '' }],
  dropped: 0, usage: { inputTokens: 100, outputTokens: 50, webSearches: 1, costUsd: 0.001, monthCostUsd: 0.001, overLimit: false, model: 'gemini-3.8-flash' },
}

test('switching projects removes the previous project AI candidates', async ({ page }) => {
  const projects = ['Isolation A', 'Isolation B'].map(title => ({ ...newProject(title), id: randomUUID(), mode: 'normal' }))
  await desktopBridge(page, { config: { enabled: true }, projects, keys: { gemini: true }, search: found })
  await page.goto('/')
  await page.getByRole('button', { name: /^Isolation A/ }).click()
  await page.getByRole('button', { name: /^Research/ }).click()
  const drawer = page.getByRole('complementary', { name: 'Research' })
  await drawer.getByRole('button', { name: 'Search about this topic' }).click()
  await drawer.getByRole('button', { name: 'Search with AI', exact: true }).click()
  await expect(drawer.locator('.ai-candidate')).toContainText('Candidate from A')
  await page.getByRole('button', { name: /^Isolation B/ }).click()
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('Isolation B')
  await expect(drawer.locator('.ai-candidate')).toHaveCount(0)
  await expect(drawer.getByRole('button', { name: 'Search about this topic' })).toBeVisible()
})

test('reopening the search form uses AI settings saved while the research drawer stayed open', async ({ page }) => {
  const project = { ...newProject('Settings refresh'), id: randomUUID(), mode: 'normal' }
  await desktopBridge(page, { config: { enabled: false }, projects: [project], keys: { gemini: true }, search: found })
  await page.goto('/')
  await page.getByRole('button', { name: /^Research/ }).click()
  const drawer = page.getByRole('complementary', { name: 'Research' })
  await drawer.getByRole('button', { name: 'Search about this topic' }).click()
  await expect(drawer.getByRole('button', { name: 'Search with AI', exact: true })).toHaveCount(0)
  await drawer.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.getByRole('button', { name: 'Open settings' }).click(); await settingsTab(page, 'AI')
  const settings = page.getByRole('dialog').locator('.ai-settings')
  await settings.getByLabel('Use AI in Divit').check()
  await settings.getByRole('button', { name: 'Save AI settings', exact: true }).click()
  await expect(settings.getByRole('status')).toHaveText('AI settings saved.')
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await drawer.getByRole('button', { name: 'Search about this topic' }).click()
  await expect(drawer.getByRole('button', { name: 'Search with AI', exact: true })).toBeVisible()
})

test('turning AI off while a search form is open prevents the pending search', async ({ page }) => {
  const project = { ...newProject('Disable while open'), id: randomUUID(), mode: 'normal' }
  await desktopBridge(page, { config: { enabled: true }, projects: [project], keys: { gemini: true }, search: found })
  await page.goto('/')
  await page.getByRole('button', { name: /^Research/ }).click()
  const drawer = page.getByRole('complementary', { name: 'Research' })
  await drawer.getByRole('button', { name: 'Search about this topic' }).click()
  await expect(drawer.getByRole('button', { name: 'Search with AI', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Open settings' }).click(); await settingsTab(page, 'AI')
  const settings = page.getByRole('dialog').locator('.ai-settings')
  await settings.getByLabel('Use AI in Divit').uncheck()
  await settings.getByRole('button', { name: 'Save AI settings', exact: true }).click()
  await expect(settings.getByRole('status')).toHaveText('AI settings saved.')
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click()
  await drawer.getByRole('button', { name: 'Search with AI', exact: true }).click()
  await expect(drawer.getByRole('alert')).toHaveText('AI settings changed. Check Settings → AI or save a request instead.')
  expect((await nativeCalls(page)).filter(call => call.cmd === 'ai_search')).toHaveLength(0)
})
