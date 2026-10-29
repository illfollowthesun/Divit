import { test, expect } from '@playwright/test'
import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { projectId, researchFolder, dropSource } from './research-helpers'

test('Search about this topic saves a request file, copies a ready prompt and waits for inbox sources', async ({ page, context }) => {
  await context.grantPermissions(['clipboard-read', 'clipboard-write'])
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  await page.getByRole('button', { name: /New writing/ }).click()
  await page.getByLabel('Title').fill('Son Vapur')
  const editor = page.getByRole('textbox', { name: 'Markdown text' })
  await editor.fill('Kış vapur tarifesi değişti.'); await editor.press('Control+a')
  await page.getByRole('button', { name: /^Research/ }).click()
  const drawer = page.getByRole('complementary', { name: 'Research' })
  await drawer.getByRole('button', { name: 'Search about this topic' }).click()
  const form = drawer.getByRole('form', { name: 'Search about this topic' })
  await expect(form.getByLabel('Topic')).toHaveValue('Kış vapur tarifesi değişti.') // the selection wins over the title
  await form.getByLabel('Topic').fill('Kış vapur tarifesi'); await form.getByLabel('Angle').fill('Sabah ilk sefer')
  await form.getByLabel('Language').selectOption('tr'); await form.getByLabel('Sources').fill('3')
  await form.getByRole('button', { name: 'Save request' }).click()
  await expect(drawer.locator('.request-status')).toContainText('Kış vapur tarifesi · Waiting for sources…')

  const id = await projectId(page), folder = researchFolder(id), inbox = resolve(folder, 'inbox')
  const [file] = await readdir(join(folder, 'requests'))
  const saved = await readFile(join(folder, 'requests', file), 'utf8')
  expect(saved).toContain('Topic: Kış vapur tarifesi'); expect(saved).toContain('How many sources: 3'); expect(saved).toContain(inbox)
  await expect(drawer.locator('.request-path')).toHaveText(resolve(folder, 'requests', file))

  await drawer.getByRole('button', { name: 'Copy request' }).click()
  await expect(drawer.getByText('Copied. Paste it into the chat.')).toBeVisible()
  const prompt: string = (await page.evaluate(() => navigator.clipboard.readText())).replaceAll('\r\n', '\n') // the Windows clipboard uses CRLF
  expect(prompt).toContain('("Son Vapur")'); expect(prompt).toContain('Language of the sources: Turkish'); expect(prompt).toContain(inbox)
  expect(prompt).toContain('---\ntitle: …\nurl: https://…')

  await dropSource(id, 'source-1.md', '---\ntitle: Şehir Hatları kış tarifesi\nurl: https://example.com/tarife\ntype: news\ntopic: Kış vapur tarifesi\n---\nİlk sefer 06:10.')
  await expect(drawer.locator('.request-status')).toContainText('1 source arrived', { timeout: 10000 })
  await expect(drawer.getByRole('button', { name: /Şehir Hatları kış tarifesi/ })).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('yazi-browser-preview-v1')!).projects[0].body)).toBe('Kış vapur tarifesi değişti.')
})
