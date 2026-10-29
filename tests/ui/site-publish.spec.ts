import { test, expect } from '@playwright/test'

test('Publish to my site stays hidden until a site repository is set; blog posts can always be exported', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  await page.getByRole('button', { name: /New writing/ }).click()
  await expect(page.getByRole('button', { name: /Publish to my site/ })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Export', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Open settings' }).click()
  const dialog = page.getByRole('dialog')
  const advanced = dialog.locator('details.settings-advanced')
  await expect(advanced).not.toHaveAttribute('open', '')
  await advanced.locator('summary').click()
  await expect(dialog.getByLabel('Site repository folder')).toHaveValue('')
  await dialog.getByLabel('Site repository folder').fill('C:\\Sites\\my-blog')
  await dialog.getByRole('button', { name: 'Save settings' }).click()
  await expect(page.getByRole('button', { name: /Publish to my site/ })).toBeVisible()
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('yazi-browser-preview-v1')!).settings.siteRepo)).toBe('C:\\Sites\\my-blog')
})
