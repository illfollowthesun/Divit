import { test, expect } from '@playwright/test'
import { startMenu } from './shell-helpers'
import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { select, projectId, researchFolder, dropSource } from './research-helpers'

const long = Array.from({ length: 12 }, (_, i) => `Cümle ${i + 1} vapurun sesini anlatıyor.`).join(' ') // 60 words
const file = `---\ntitle: İskele notları\nsite: Şehir Günlüğü\npublished: 2026-10-20\nurl: https://example.com/iskele\ntype: blog\n---\nİlk vapur 06:10 kalkıyor.\n\n${long}`
const stored = (page: import('@playwright/test').Page) => page.evaluate(() => JSON.parse(localStorage.getItem('yazi-browser-preview-v1')!).projects[0])

test('old Notebook research notes are copied once into Research notes; the originals stay in the project', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  await startMenu(page, 'New story or book'); await page.getByRole('button', { name: 'Create project', exact: true }).click()
  await page.keyboard.press('Control+s'); await expect(page.getByRole('status').first()).toHaveText('All changes saved')
  await page.evaluate(() => {
    const lib = JSON.parse(localStorage.getItem('yazi-browser-preview-v1')!)
    lib.projects[0].notes = [{ id: 'old-1', kind: 'research', title: 'Ferry routes', body: 'Check the winter timetable.', when: '' }, { id: 'old-2', kind: 'timeline', title: 'Departure', body: 'First ferry.', when: 'Day 1' }]
    localStorage.setItem('yazi-browser-preview-v1', JSON.stringify(lib))
  })
  await page.reload()
  await page.getByRole('tab', { name: 'Notebook', exact: true }).click()
  await expect(page.locator('.notebook-tabs').getByRole('button')).toHaveText(['Timeline', 'Writing log'])
  await expect(page.locator('.project-notes')).toContainText('Departure')
  await page.getByRole('button', { name: /^Research/ }).click()
  const drawer = page.getByRole('complementary', { name: 'Research' })
  await drawer.getByRole('tab', { name: 'Notes' }).click()
  await expect(drawer.locator('.research-note')).toHaveCount(1)
  await expect(drawer.locator('.research-note')).toContainText('from the NotebookFerry routesCheck the winter timetable.')
  await page.reload(); await page.getByRole('button', { name: /^Research/ }).click(); await drawer.getByRole('tab', { name: 'Notes' }).click()
  await expect(drawer.locator('.research-note')).toHaveCount(1)
  expect((await stored(page)).notes.map((n: { id: string }) => n.id)).toEqual(['old-1', 'old-2'])
})

test('Insert quote always carries the citation, as a quote block or footnote, warns over 50 words and marks the source used', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  await page.getByRole('button', { name: /New writing/ }).click()
  const editor = page.getByRole('textbox', { name: 'Markdown text' })
  await editor.fill('My opening line.')
  const id = await projectId(page); await dropSource(id, 'iskele.md', file)
  await page.getByRole('button', { name: /^Research/ }).click()
  const drawer = page.getByRole('complementary', { name: 'Research' })
  await drawer.getByRole('button', { name: /İskele notları/ }).click({ timeout: 10000 })
  await expect(drawer.locator('.source-text')).toContainText('Cümle 12')
  await select(page, 'İlk vapur 06:10')
  await page.getByRole('dialog', { name: 'Highlight selection' }).getByRole('button', { name: 'Highlight in Sky' }).click()
  await expect(drawer.locator('mark.hl-3')).toHaveText('İlk vapur 06:10')

  // From the reader: insert straight from a selection.
  await select(page, 'Cümle 1 vapurun sesini anlatıyor.')
  await page.getByRole('dialog', { name: 'Highlight selection' }).getByRole('button', { name: 'Insert quote' }).click()
  await expect(drawer.getByRole('status')).toHaveText('Quote inserted with its source.')
  await expect(drawer.locator('.source-used')).toHaveText('Quoted in the text')

  // A long quote asks first; Cancel inserts nothing.
  await select(page, long)
  await page.getByRole('dialog', { name: 'Highlight selection' }).getByRole('button', { name: 'Insert quote' }).click()
  await expect(drawer.getByRole('alert')).toContainText('This quote is 60 words.')
  await drawer.getByRole('button', { name: 'Cancel', exact: true }).click()
  await page.keyboard.press('Control+s'); await expect(page.locator('.editor-footer [role=status]')).toHaveText('All changes saved')
  expect((await stored(page)).body).toBe('My opening line.\n\n> Cümle 1 vapurun sesini anlatıyor.\n>\n> — İskele notları, Şehir Günlüğü (2026-10-20), https://example.com/iskele\n\n')

  // From the Highlights tab, as a footnote.
  await drawer.getByRole('button', { name: '← All sources' }).click()
  await drawer.getByRole('tab', { name: /Highlights/ }).click()
  await expect(drawer.locator('.highlight-item')).toHaveText(/İlk vapur 06:10/)
  await drawer.getByLabel('Insert as').selectOption('footnote')
  // Register before inserting: saving the draft does not wait for research usage writes.
  const highlightedUse = page.waitForResponse(response => {
    const request = response.request()
    if (new URL(response.url()).pathname !== '/__yazi/research' || request.method() !== 'POST') return false
    const payload = request.postDataJSON()
    return payload.projectId === id && payload.action === 'update-source' && typeof payload.patch?.addUse?.highlightId === 'string'
  })
  await drawer.getByRole('button', { name: /^Insert quote: İlk vapur/ }).click()
  await expect(drawer.getByRole('status')).toHaveText('Quote inserted with its source as a footnote.')
  await page.keyboard.press('Control+s'); await expect(page.locator('.editor-footer [role=status]')).toHaveText('All changes saved')
  const body: string = (await stored(page)).body
  expect(body).toContain('“İlk vapur 06:10”[^1]')
  expect(body.endsWith('\n\n[^1]: İskele notları, Şehir Günlüğü (2026-10-20), https://example.com/iskele')).toBe(true)
  expect(body.startsWith('My opening line.')).toBe(true)

  const savedUse = await highlightedUse
  expect(savedUse.ok()).toBe(true)
  expect(await savedUse.finished()).toBeNull()
  const index = JSON.parse(await readFile(join(researchFolder(id), 'research.json'), 'utf8'))
  expect(index.sources[0].status).toBe('used')
  expect(index.sources[0].usedIn.map((u: { sectionId: string | null; highlightId?: string }) => [u.sectionId, !!u.highlightId])).toEqual([[null, false], [null, true]])
  await drawer.getByRole('button', { name: 'Open in source' }).click()
  await expect(drawer.locator('mark.hl-3')).toBeFocused()

  // Notes can link to a highlight and are set aside, never deleted.
  await drawer.getByRole('button', { name: '← All sources' }).click(); await drawer.getByRole('tab', { name: 'Notes' }).click()
  await drawer.getByRole('button', { name: '+ Note' }).click()
  await drawer.getByLabel('Note title').fill('Opening idea'); await drawer.getByLabel('Note', { exact: true }).fill('Start with the first ferry.')
  await drawer.getByLabel('Linked highlight').selectOption({ label: 'İlk vapur 06:10' }); await drawer.getByRole('button', { name: 'Save note' }).click()
  await expect(drawer.locator('.research-note .linked-quote')).toHaveText('“İlk vapur 06:10”')
  await drawer.getByRole('button', { name: 'Set aside', exact: true }).click(); await expect(drawer.locator('.research-note')).toHaveCount(0)
  await drawer.getByText('Set-aside notes').click(); await drawer.getByRole('button', { name: 'Restore note' }).click()
  await expect(drawer.locator('.research-note')).toContainText('Opening idea')
  expect(JSON.parse(await readFile(join(researchFolder(id), 'research.json'), 'utf8')).notes).toHaveLength(1)
})
