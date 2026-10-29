import { test, expect } from '@playwright/test'

test.describe('on a Turkish Windows', () => {
  test.use({ locale: 'tr-TR' })
  test('the interface starts in Turkish; the writing language stays a separate choice', async ({ page }) => {
    await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
    await expect(page.getByRole('button', { name: 'Ayarları aç' })).toBeVisible()
    await page.getByRole('button', { name: /Yeni yazı/ }).click()
    await expect(page.getByRole('combobox', { name: 'Yazma modu' })).toBeVisible()
    await expect(page.locator('.metadata select')).toHaveValue('auto')
    await expect(page.locator('html')).toHaveAttribute('lang', 'tr')
  })
})

test('choosing English or Türkçe in Settings changes the interface at once and is saved', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  await page.getByRole('button', { name: 'Open settings' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Interface language').selectOption('tr')
  await dialog.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.getByRole('button', { name: 'Ayarları aç' })).toBeVisible()
  await expect(page.getByText('Kelimeleriniz için küçük bir oda.')).toBeVisible()
  await page.reload()
  await expect(page.getByRole('button', { name: 'Ayarları aç' })).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('yazi-browser-preview-v1')!).settings.uiLanguage)).toBe('tr')
})
