import { test, expect, type Page } from '@playwright/test'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'

async function start(page: Page) {
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  await page.getByRole('button', { name: /New writing/ }).click()
  await expect(page.getByRole('textbox', { name: 'Markdown text' })).toBeVisible()
}
const row = (page: Page) => page.getByRole('toolbar', { name: 'Project actions' })

test('the app row holds only navigation and Settings; the project row holds the view toggles, the save state and the panel icons', async ({ page }) => {
  await start(page)
  const app = page.getByRole('banner')
  for (const name of ['Typewriter', 'Focus', 'Side panel']) await expect(app.getByRole('button', { name, exact: true })).toHaveCount(0)
  await expect(app.getByRole('button', { name: 'Settings' })).toBeVisible()
  for (const name of ['Typewriter', 'Focus', 'Export']) await expect(row(page).getByRole('button', { name, exact: true })).toBeVisible()
  await expect(row(page).getByLabel('Writing mode')).toBeVisible()
  await expect(row(page).getByRole('button', { name: 'Library', exact: true })).toHaveAttribute('title', 'Library (Ctrl+Alt+L)')
  await expect(row(page).getByRole('button', { name: 'Side panel', exact: true })).toHaveAttribute('title', /\(Ctrl\+Alt\+P\)/)
  // The save state sits beside the status, not in the bottom row.
  await expect(row(page).locator('.save-state')).toHaveText('Saved')
  await page.getByRole('textbox', { name: 'Markdown text' }).fill('A few words.')
  await expect(row(page).locator('.save-state')).toHaveText(/Unsaved changes|Saving…/)
  await expect(row(page).locator('.save-state')).toHaveText('Saved')
  await expect(page.locator('.editor-footer [role=status]')).toHaveCount(0)
  expect((await page.locator('.editor-footer').boundingBox())!.height).toBeLessThanOrEqual(36)
})

test('the library can be put away with its icon or Ctrl+Alt+L, keeps the text at a reading measure and is remembered', async ({ page }) => {
  await start(page)
  const library = page.getByRole('complementary', { name: 'Writing library' }), icon = row(page).getByRole('button', { name: 'Library', exact: true })
  await expect(library).toBeVisible(); await expect(icon).toHaveAttribute('aria-pressed', 'true')
  await icon.click(); await expect(library).toBeHidden(); await expect(icon).toHaveAttribute('aria-pressed', 'false')
  const paper = (await page.locator('.paper').boundingBox())!, text = (await page.locator('.markdown-editor').boundingBox())!
  expect(text.width).toBeLessThanOrEqual(760); expect(paper.width).toBeGreaterThan(text.width)
  await page.reload(); await expect(page.getByRole('textbox', { name: 'Markdown text' })).toBeVisible(); await expect(library).toBeHidden()
  await page.keyboard.press('Control+Alt+l'); await expect(library).toBeVisible()
  await page.reload(); await expect(library).toBeVisible()
})

test('the side panel icon shows and hides the dock', async ({ page }) => {
  await start(page)
  const dock = page.getByRole('complementary', { name: 'Writing companion' }), icon = row(page).getByRole('button', { name: 'Side panel', exact: true })
  await expect(dock).toBeVisible(); await expect(icon).toHaveAttribute('aria-pressed', 'true')
  await icon.click(); await expect(dock).toBeHidden(); await expect(icon).toHaveAttribute('aria-pressed', 'false')
  await icon.click(); await expect(dock).toBeVisible()
})

test('Research is a tab of the dock: Ctrl+Alt+R shows it, again returns to the previous tab, and the tab is remembered per project type', async ({ page }) => {
  await start(page)
  const dock = page.getByRole('complementary', { name: 'Writing companion' }), tab = (name: string) => dock.getByRole('tab', { name, exact: true })
  await expect(dock.getByRole('tab')).toHaveText(['Preview', 'Research', 'Images'])
  await expect(row(page).getByRole('button', { name: 'Research' })).toHaveCount(0)
  await tab('Images').click(); await expect(tab('Images')).toHaveAttribute('aria-selected', 'true')
  await page.keyboard.press('Control+Alt+r')
  await expect(tab('Research')).toHaveAttribute('aria-selected', 'true'); await expect(page.locator('.research-tab')).toBeVisible()
  await expect(page.getByLabel('Web address to save')).toBeFocused()
  await expect(page.locator('.research-tab').getByText('RESEARCH', { exact: true })).toHaveCount(0) // the tab is the header
  await page.keyboard.press('Control+Alt+r'); await expect(tab('Images')).toHaveAttribute('aria-selected', 'true')
  // The last tab is kept for the next visit, separately for each project type.
  await tab('Research').click(); await page.reload()
  await expect(page.getByRole('textbox', { name: 'Markdown text' })).toBeVisible()
  await expect(tab('Research')).toHaveAttribute('aria-selected', 'true'); await expect(page.getByLabel('Web address to save')).not.toBeFocused()
  await page.getByRole('button', { name: 'More ways to start' }).click()
  await page.getByRole('menu', { name: 'More ways to start' }).getByText('New story or book', { exact: true }).click()
  await page.getByLabel('Project type').selectOption('book'); await page.getByRole('button', { name: 'Create project', exact: true }).click()
  await expect(dock.getByRole('tab')).toHaveText(['Preview', 'Cards', 'Notebook', 'Research', 'Images'])
  await expect(tab('Preview')).toHaveAttribute('aria-selected', 'true')
})

test('the Research tab: one input row whose button follows the input, a Search about link, a segmented control and quiet status lines', async ({ page }) => {
  const server = createServer((_, res) => { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); res.end('<!doctype html><title>The crossing | Harbour Notes</title><article><h1>The crossing</h1><p>The first boat leaves at six.</p></article>') }).listen(0, '127.0.0.1')
  await new Promise(resolve => server.once('listening', resolve))
  await start(page); await page.getByLabel('Title').fill('Harbour')
  await page.keyboard.press('Control+Alt+r')
  const panel = page.locator('.research-tab'), input = page.getByLabel('Web address to save'), save = panel.getByRole('button', { name: 'Save', exact: true })
  await expect(panel.locator('.segmented').getByRole('tab')).toHaveText(['Sources', 'Highlights', 'Notes'])
  await expect(save).toBeDisabled(); await expect(panel.getByRole('button', { name: 'Search about: Harbour' })).toBeVisible()
  await expect(panel.getByRole('button', { name: /^(Search about this topic|Search about)/ })).toHaveCount(1) // no second full-width button
  await input.fill('ferry timetable'); await expect(panel.getByRole('button', { name: 'Search', exact: true })).toBeVisible(); await expect(panel.getByRole('button', { name: /^Search about/ })).toHaveCount(0)
  await input.fill(`http://127.0.0.1:${(server.address() as AddressInfo).port}/crossing`); await expect(save).toBeEnabled()
  const top = () => panel.locator('.source-list').evaluate(el => el.getBoundingClientRect().top)
  await save.click()
  const status = panel.getByRole('status')
  await expect(status).toHaveText(/Saved a readable copy: The crossing/, { timeout: 15000 })
  const shown = await top(); expect((await status.boundingBox())!.y).toBeGreaterThan(shown) // the message sits below the list
  await expect(status).toHaveText('', { timeout: 10000 }) // fades by itself
  expect(await top()).toBe(shown) // and nothing moved when it appeared or left
  const row = panel.locator('.source-row')
  await expect(row).toContainText('Harbour Notes'); await expect(row.locator('.type-chip')).toBeVisible(); await expect(row.locator('small .unread-dot')).toHaveCount(1) // the dot belongs to the meta line
  server.close()
})

test('the export dialog says what is exported, lists formats as radio rows and swaps the button for the file name', async ({ page }) => {
  await start(page)
  await page.getByLabel('Title').fill('The Last Ferry'); await page.getByRole('textbox', { name: 'Markdown text' }).fill('The first boat leaves at six.')
  await row(page).getByRole('button', { name: 'Export', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'A finished copy' })
  await expect(dialog.locator('.export-what')).toHaveText('The Last Ferry') // a blog post has no chapters to count
  await expect(dialog.locator('select')).toHaveCount(0); await expect(dialog.locator('.export-summary')).toHaveCount(0)
  await expect(dialog.getByRole('radio')).toHaveCount(4)
  await expect(dialog.getByRole('radio', { name: 'Word' })).toBeChecked()
  for (const name of ['Word', 'PDF', 'Markdown']) await expect(dialog.getByRole('radio', { name })).toHaveAccessibleDescription('Made by Divit itself. No extra tools are needed.')
  await expect(dialog.getByRole('radio', { name: 'EPUB' })).toHaveAccessibleDescription(/Checking local export tools|EPUB is made with|EPUB needs Pandoc/)
  // The Sources option lines up with the rows and says why it is off.
  const sources = dialog.getByRole('checkbox', { name: /Add a Sources list/ })
  await expect(sources).toBeDisabled(); await expect(sources).toHaveAccessibleDescription('No sources quoted yet')
  const left = (locator: ReturnType<typeof dialog.locator>) => locator.evaluate(el => el.getBoundingClientRect().left)
  expect(Math.abs(await left(dialog.getByRole('radio', { name: 'Word' })) - await left(sources))).toBeLessThan(2)
  // One primary button; after exporting, the file name and Show in folder take its place.
  await dialog.getByRole('radio', { name: 'Markdown' }).check()
  const download = page.waitForEvent('download'); await dialog.getByRole('button', { name: 'Export manuscript' }).click(); await download
  await expect(dialog.getByRole('button', { name: 'Export manuscript' })).toHaveCount(0)
  await expect(dialog.locator('.export-result')).toContainText(/\.md/); await expect(dialog.locator('.export-result')).toContainText('Copy ready')
  await dialog.getByRole('radio', { name: 'PDF' }).check(); await expect(dialog.getByRole('button', { name: 'Export manuscript' })).toBeVisible()
})

test('the outline heading stays while the list scrolls, and the shortcut sheet scrolls cleanly with the library row', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 760 })
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  await page.getByRole('button', { name: 'More ways to start' }).click()
  await page.getByRole('menu', { name: 'More ways to start' }).getByText('New story or book', { exact: true }).click()
  await page.getByLabel('Project type').selectOption('book'); await page.getByRole('button', { name: 'Create project', exact: true }).click()
  await page.getByRole('button', { name: '+ Chapter' }).click()
  for (let i = 0; i < 16; i++) await page.getByRole('button', { name: '+ Scene' }).click()
  const scroll = page.locator('.outline-scroll'), heading = page.locator('.outline .section-label')
  await scroll.evaluate(el => { el.scrollTop = el.scrollHeight })
  expect(await scroll.evaluate(el => el.scrollTop)).toBeGreaterThan(0)
  await expect(heading).toBeInViewport({ ratio: 1 }); await expect(heading).toHaveText(/MANUSCRIPT/)
  expect((await heading.boundingBox())!.y).toBeLessThan((await scroll.boundingBox())!.y) // the heading sits above the scrolling part

  await page.keyboard.press('F1')
  const list = page.locator('.shortcut-scroll'), dialog = page.getByRole('dialog')
  await expect(dialog.getByText('Show or hide the library')).toBeVisible()
  await list.evaluate(el => { el.scrollTop = el.scrollHeight })
  const last = dialog.locator('.shortcut-list > div').last(), box = (await list.boundingBox())!, lastBox = (await last.boundingBox())!
  expect(lastBox.y + lastBox.height).toBeLessThanOrEqual(box.y + box.height - 8) // a little room under the last row
  expect((await dialog.boundingBox())!.y + (await dialog.boundingBox())!.height).toBeLessThanOrEqual(760)
})
