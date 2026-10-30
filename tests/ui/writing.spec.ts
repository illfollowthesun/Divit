import { test, expect } from '@playwright/test'
import { more } from './shell-helpers'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await expect(page.locator('.preview-notice')).toContainText('Browser preview')
})

test('writing survives switching and reload; preview and word count reflect text', async ({ page }) => {
  await page.getByRole('button', { name: /New writing/ }).click()
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('İstanbul günlüğü')
  await page.getByRole('textbox', { name: 'Markdown text' }).fill('Merhaba dünya.\n\n## Bir sokak\n\nYağmurdan sonra.')
  await page.keyboard.press('Control+s')
  await expect(page.getByRole('status')).toHaveText('All changes saved')
  await expect(page.locator('.prose h2')).toHaveText('Bir sokak')
  await page.getByRole('button', { name: /New writing/ }).click()
  await page.getByRole('textbox', { name: 'Title', exact: true }).fill('İkinci sayfa')
  await page.getByRole('button', { name: /İstanbul günlüğü.*Draft/ }).click()
  await expect(page.getByRole('textbox', { name: 'Markdown text' })).toContainText('Merhaba dünya.')
  await page.reload()
  await page.getByRole('button', { name: /İstanbul günlüğü.*Draft/ }).click()
  await expect(page.getByRole('textbox', { name: 'Markdown text' })).toContainText('Yağmurdan sonra.')
})

test('idea becomes a linked draft, and archived writing can be restored', async ({ page }) => {
  await page.getByRole('button', { name: /Idea box/ }).click()
  await page.getByRole('textbox', { name: 'New idea', exact: true }).fill('Vapurda bir sabah')
  await page.getByRole('button', { name: /Catch idea/ }).click()
  await page.getByRole('button', { name: /Start writing/ }).click()
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('Vapurda bir sabah')
  await more(page, 'Archive')
  await page.getByRole('button', { name: /Trash/ }).click()
  await expect(page.locator('.trash-list')).toContainText('Vapurda bir sabah')
  await page.getByRole('button', { name: 'Restore', exact: true }).click()
  await expect(page.locator('.trash-list')).not.toContainText('Vapurda bir sabah')
  await page.getByRole('button', { name: /Vapurda bir sabah.*Draft/ }).click()
  await expect(page.getByRole('textbox', { name: 'Title', exact: true })).toHaveValue('Vapurda bir sabah')
})

test('focus shortcut and dark theme persist', async ({ page }) => {
  await page.getByRole('button', { name: /New writing/ }).click()
  await page.keyboard.press('Control+.')
  await expect(page.getByRole('complementary', { name: 'Writing library' })).toBeHidden()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('complementary', { name: 'Writing library' })).toBeVisible()
  await page.getByRole('button', { name: 'Open settings' }).click()
  await page.getByLabel('Appearance').selectOption('dark')
  await page.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
})

test('preview rejects active HTML and remote image requests', async ({ page }) => {
  const requests: string[] = []
  page.on('request', request => { if (request.url().includes('example.invalid')) requests.push(request.url()) })
  await page.getByRole('button', { name: /New writing/ }).click()
  await page.getByRole('textbox', { name: 'Markdown text' }).fill('![remote](https://example.invalid/image.jpg)\n\n<img src="https://example.invalid/raw.jpg" onerror="window.pwned=true">\n\n<script>window.pwned=true</script>')
  await expect(page.locator('.prose')).toContainText('[Image: remote]')
  await expect(page.locator('.prose script')).toHaveCount(0)
  expect(await page.evaluate(() => 'pwned' in window)).toBe(false)
  expect(requests).toEqual([])
})
