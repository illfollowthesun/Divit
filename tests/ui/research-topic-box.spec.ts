import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { newProject } from '../../src/shared/types'
import { desktopBridge, nativeCalls } from './desktop-bridge'

const project = () => ({ ...newProject('Ferry notes'), id: randomUUID(), mode: 'normal' })
async function openDrawer(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.getByRole('button', { name: /Ferry notes/ }).click()
  await page.getByRole('button', { name: /^Research/ }).click()
  return page.getByRole('complementary', { name: 'Research' })
}

test('a topic typed into the Sources box is never fetched; with AI on it offers Search this with AI', async ({ page }) => {
  await desktopBridge(page, { config: { enabled: true }, keys: { gemini: true }, projects: [project()] })
  const drawer = await openDrawer(page)
  const box = drawer.getByLabel('Web address to save, or a topic to search')
  await box.fill('winter ferry timetable')
  await expect(drawer.locator('.add-url-hint')).toHaveText('Not a web address, so it will be searched as a topic.')
  await drawer.getByRole('button', { name: 'Search this with AI' }).click()
  const form = drawer.getByRole('form', { name: 'Search about this topic' })
  await expect(form.getByLabel('Topic', { exact: true })).toHaveValue('winter ferry timetable')
  await expect(form.getByRole('button', { name: 'Search with AI' })).toBeVisible()
  await expect(box).toHaveValue('')
  expect((await nativeCalls(page)).filter(c => c.cmd === 'research_action' && c.args.action === 'fetch-page')).toEqual([])
})

test('with AI off the Sources box points to Settings and still prefills a request', async ({ page }) => {
  await desktopBridge(page, { config: { enabled: false }, projects: [project()] })
  const drawer = await openDrawer(page)
  const box = drawer.getByLabel('Web address to save, or a topic to search')
  await box.fill('Node.js')
  await expect(drawer.getByRole('button', { name: 'Turn on AI in Settings to search' })).toBeVisible()
  await box.press('Enter')
  const form = drawer.getByRole('form', { name: 'Search about this topic' })
  await expect(form.getByLabel('Topic', { exact: true })).toHaveValue('Node.js')
  await expect(form.getByRole('button', { name: 'Save request' })).toBeVisible()
  await box.fill('kış vapuru')
  await drawer.getByRole('button', { name: 'Turn on AI in Settings to search' }).click()
  await expect(page.getByRole('dialog', { name: 'Settings' })).toBeVisible()
})
