import { test, expect } from '@playwright/test'

const paper = (page: import('@playwright/test').Page) => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--paper').trim())

test('themes apply at once from Settings and the shortcut sheet, and are remembered', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByRole('button', { name: 'Open settings' }).click()
  const appearance = page.getByRole('dialog').getByLabel(/^Appearance/)
  await expect(appearance.locator('option')).toHaveText(['Match Windows', 'Warm paper', 'Sage paper', 'Dusty blue ink', 'After hours', 'Terracotta evening', 'Plum night'])
  await appearance.selectOption('plum')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'plum'); await expect(page.locator('html')).toHaveAttribute('data-tone', 'dark')
  expect(await paper(page)).toBe('#241e2b')
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await page.reload(); await expect(page.locator('html')).toHaveAttribute('data-theme', 'plum')

  await page.getByRole('button', { name: /Keyboard shortcuts/ }).click()
  await page.getByRole('dialog').getByLabel('Theme').selectOption('sage')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sage'); expect(await paper(page)).toBe('#f3f6ef')
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('yazi-browser-preview-v1')!).settings.theme)).toBe('sage')
})

test('Match Windows follows the system light or dark setting while the app is open', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' })
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  await page.getByRole('button', { name: 'Open settings' }).click()
  await page.getByRole('dialog').getByLabel(/^Appearance/).selectOption('system')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.emulateMedia({ colorScheme: 'dark' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  expect(await paper(page)).toBe('#252620')
})
