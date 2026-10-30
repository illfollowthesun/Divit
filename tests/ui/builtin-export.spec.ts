import { test, expect } from '@playwright/test'
import { startMenu } from './shell-helpers'
import { readFile } from 'node:fs/promises'
import { createRequire } from 'node:module'
const JSZip = createRequire(import.meta.url)('jszip')

test('Word and PDF exports work with no extra tools and say which path made them', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  await startMenu(page, 'New story or book')
  await page.getByLabel('Project type').selectOption('book'); await page.getByLabel('Project title').fill('İstanbul at dawn')
  await page.getByRole('button', { name: 'Create project', exact: true }).click()
  await page.getByRole('button', { name: '+ Chapter', exact: true }).click(); await page.getByLabel('Section title').fill('Şafak')
  await page.getByRole('textbox', { name: 'Markdown text' }).fill('Vapur **erken** kalktı; martılar *ışıktan önce* geldi.[^1]\n\n[^1]: Şehir Hatları, 2026.')
  await page.getByRole('button', { name: 'Export', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'A finished copy' })
  await expect(dialog.getByLabel('Export format')).toHaveValue('docx')
  await expect(dialog).toContainText('No extra tools are needed.')

  let pending = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Export manuscript' }).click()
  let download = await pending
  expect(download.suggestedFilename()).toMatch(/^istanbul-at-dawn-\d{4}-\d\d-\d\d\.docx$/)
  const zip = await JSZip.loadAsync(await readFile((await download.path())!))
  const xml: string = await zip.file('word/document.xml').async('string')
  for (const text of ['İstanbul at dawn', 'Şafak', 'erken', 'ışıktan önce', 'Şehir Hatları, 2026.']) expect(xml).toContain(text)
  expect(xml).not.toContain('[^1]')
  await expect(dialog.locator('.export-result')).toContainText('Made with the built-in exporter.')

  await dialog.getByLabel('Export format').selectOption('pdf')
  pending = page.waitForEvent('download')
  await dialog.getByRole('button', { name: 'Export manuscript' }).click()
  download = await pending
  await download.saveAs(test.info().outputPath('manuscript.pdf'))
  const pdf = await readFile((await download.path())!)
  expect(pdf.subarray(0, 5).toString()).toBe('%PDF-'); expect(pdf.length).toBeGreaterThan(5000)
  expect(download.suggestedFilename()).toMatch(/\.pdf$/)

  await dialog.getByLabel('Export format').selectOption('epub')
  await expect(dialog).toContainText(/EPUB (needs Pandoc|is made with)/)
})
