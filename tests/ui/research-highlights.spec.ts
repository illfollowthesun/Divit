import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

// Selects `phrase` inside the reader the way a mouse drag would, then releases the button.
async function select(page: Page, phrase: string) {
  await page.evaluate(phrase => {
    // The phrase may run across a highlight and plain text, so search the joined text nodes.
    const root = document.querySelector('.source-text')!, walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes: Text[] = []
    while (walker.nextNode()) nodes.push(walker.currentNode as Text)
    const joined = nodes.map(n => n.data).join(''), at = joined.indexOf(phrase)
    if (at === -1) throw new Error(`Not found: ${phrase}`)
    const locate = (offset: number) => { for (const node of nodes) { if (offset <= node.data.length) return [node, offset] as const; offset -= node.data.length } throw new Error('offset') }
    const range = document.createRange(); range.setStart(...locate(at)); range.setEnd(...locate(at + phrase.length))
    getSelection()!.removeAllRanges(); getSelection()!.addRange(range)
    root.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  }, phrase)
}
const body = 'Kış tarifesinde ilk vapur 06:10 kalkıyor.\n\nMartılar ışıktan önce geliyor; iskele sessiz.\n\nSon vapur 23:30.'

test('highlights and notes stay on the source across restarts and edits to the saved file', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  await page.getByRole('button', { name: /New writing/ }).click()
  await page.getByRole('textbox', { name: 'Markdown text' }).fill('My own sentence.')
  const id: string = await page.evaluate(() => JSON.parse(localStorage.getItem('yazi-browser-preview-v1')!).projects[0].id)
  const research = join('.tmp/yazi-preview/projects', id, 'research')
  await mkdir(join(research, 'inbox'), { recursive: true })
  await writeFile(join(research, 'inbox', 'iskele.md'), `---\ntitle: İskele notları\ntype: blog\n---\n${body}`)
  await page.getByRole('button', { name: /^Research/ }).click()
  const drawer = page.getByRole('complementary', { name: 'Research' })
  await drawer.getByRole('button', { name: /İskele notları/ }).click({ timeout: 10000 })
  const reader = drawer.getByRole('article'), popover = page.getByRole('dialog', { name: 'Highlight selection' })
  await expect(reader).toContainText('Son vapur 23:30.')

  await select(page, 'ilk vapur 06:10')
  await expect(popover.getByRole('button', { name: /^Highlight in / })).toHaveCount(4)
  expect((await popover.boundingBox())!.y).toBeLessThan((await reader.getByText('Kış tarifesinde').boundingBox())!.y)
  await popover.getByRole('button', { name: 'Highlight in Sage' }).click()
  await expect(reader.locator('mark.hl-2')).toHaveText('ilk vapur 06:10'); await expect(popover).toHaveCount(0)

  await select(page, 'Martılar ışıktan önce')
  await popover.getByRole('button', { name: 'Add note' }).click(); await popover.getByLabel('Note').fill('Use in the opening.')
  await popover.getByRole('button', { name: 'Save with note' }).click()
  await expect(reader.locator('mark.has-note')).toHaveText('Martılar ışıktan önce')

  await select(page, 'vapur 06:10 kalkıyor')
  await expect(popover).toContainText('overlaps a highlight')
  await page.keyboard.press('Escape'); await expect(popover).toHaveCount(0); await expect(reader).toBeVisible()

  await page.reload(); await page.getByRole('button', { name: /^Research/ }).click()
  await drawer.getByRole('button', { name: /İskele notları/ }).click()
  await expect(reader.locator('mark')).toHaveText(['ilk vapur 06:10', 'Martılar ışıktan önce'])
  const index = JSON.parse(await readFile(join(research, 'research.json'), 'utf8'))
  expect(index.highlights.map((h: { quote: string; color: number; note?: string }) => [h.quote, h.color, h.note])).toEqual([['ilk vapur 06:10', 2, undefined], ['Martılar ışıktan önce', 1, 'Use in the opening.']])

  // The saved file is edited outside Yazı: highlights follow their quotes; a vanished quote is kept as lost.
  const [file] = await readdir(join(research, 'sources'))
  const saved = await readFile(join(research, 'sources', file), 'utf8')
  await writeFile(join(research, 'sources', file), saved.replace('Kış tarifesinde', 'Yeni bir giriş.\n\nKış tarifesinde').replace('Martılar ışıktan önce', 'Kuşlar'))
  await reader.getByRole('button', { name: '← All sources' }).click(); await drawer.getByRole('button', { name: /İskele notları/ }).click()
  await expect(reader.locator('mark')).toHaveText(['ilk vapur 06:10'])
  await expect(reader).toContainText('One highlight no longer match')

  await reader.locator('mark').click()
  const edit = page.getByRole('dialog', { name: 'Edit highlight' })
  await edit.getByRole('button', { name: 'Change to Rose' }).click()
  await expect(reader.locator('mark.hl-4')).toHaveText('ilk vapur 06:10')
  await reader.locator('mark').click(); await edit.getByRole('button', { name: 'Remove highlight' }).click()
  await expect(reader.locator('mark')).toHaveCount(0)
  expect(JSON.parse(await readFile(join(research, 'research.json'), 'utf8')).highlights.map((h: { quote: string }) => h.quote)).toEqual(['Martılar ışıktan önce'])
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('yazi-browser-preview-v1')!).projects[0].body)).toBe('My own sentence.')
})
