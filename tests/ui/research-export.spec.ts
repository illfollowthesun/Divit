import { test, expect } from '@playwright/test'
import { startMenu } from './shell-helpers'
import { readFile } from 'node:fs/promises'
import { select, projectId, dropSource, openResearch } from './research-helpers'

test('Export can end with a Sources list built from the sources actually quoted', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  await startMenu(page, 'New story or book'); await page.getByLabel('Project title').fill('Son Vapur')
  await page.getByRole('button', { name: 'Create project', exact: true }).click()
  await page.getByRole('textbox', { name: 'Markdown text' }).fill('İlk vapur kalktı.')
  const id = await projectId(page)
  await dropSource(id, 'quoted.md', '---\ntitle: İskele notları\nsite: Şehir Günlüğü\npublished: 2026-10-20\nurl: https://example.com/iskele\n---\nMartılar ışıktan önce geliyor.')
  await dropSource(id, 'unused.md', '---\ntitle: Okunmuş ama alıntılanmamış\nurl: https://example.com/other\n---\nBaşka bir metin.')

  await page.getByRole('button', { name: 'Export', exact: true }).click(); await page.getByRole('radio', { name: 'Markdown' }).check()
  await expect(page.getByLabel(/Add a Sources list/)).toBeDisabled()
  await expect(page.getByText('No sources quoted yet')).toBeVisible()
  await page.getByRole('button', { name: 'Close dialog', exact: true }).click()

  await openResearch(page)
  const drawer = page.locator('.research-tab')
  await drawer.getByRole('button', { name: /İskele notları/ }).click({ timeout: 10000 })
  await expect(drawer.locator('.source-text')).toContainText('Martılar')
  await select(page, 'Martılar ışıktan önce geliyor.')
  await page.getByRole('dialog', { name: 'Highlight selection' }).getByRole('button', { name: 'Insert quote' }).click()
  await expect(drawer.getByRole('status')).toHaveText('Quote inserted with its source.')
  await page.keyboard.press('Escape'); await page.keyboard.press('Control+Alt+r'); await expect(drawer).toHaveCount(0)

  await page.getByRole('button', { name: 'Export', exact: true }).click(); await page.getByRole('radio', { name: 'Markdown' }).check()
  const option = page.getByLabel(/Add a Sources list/)
  await expect(page.getByText('1 quoted source', { exact: true })).toBeVisible()
  await expect(option).not.toBeChecked(); await option.check()
  const download = page.waitForEvent('download'); await page.getByRole('button', { name: 'Export manuscript', exact: true }).click()
  const markdown = await readFile(await (await download).path(), 'utf8')
  expect(markdown).toContain('İlk vapur kalktı.')
  expect(markdown).toContain('> Martılar ışıktan önce geliyor.\n>\n> — İskele notları, Şehir Günlüğü (2026-10-20), https://example.com/iskele')
  expect(markdown.endsWith('\n\n# Sources\n\n- İskele notları, Şehir Günlüğü (2026-10-20), https://example.com/iskele\n')).toBe(true)
  expect(markdown).not.toContain('Okunmuş ama alıntılanmamış')
})
