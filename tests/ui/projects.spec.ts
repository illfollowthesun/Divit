import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  await expect(page.locator('.preview-notice')).toContainText('Browser preview')
})

test('story and book projects keep their type across restart', async ({ page }) => {
  for (const type of ['story', 'book']) {
    await page.getByRole('button', { name: /New story or book/ }).click()
    await page.getByLabel('Project type').selectOption(type)
    await page.getByLabel('Project title').fill(type === 'story' ? 'The Last Ferry' : 'Rooms of the City')
    await page.getByRole('button', { name: 'Create project', exact: true }).click()
    await expect(page.locator('.document-toolbar')).toContainText(type.toUpperCase())
    await expect(page.getByRole('button', { name: /Send to site/ })).toHaveCount(0)
  }
  await page.reload()
  await expect(page.locator('.document-toolbar')).toContainText('BOOK')
  await page.locator('.document-list').getByRole('button', { name: /The Last Ferry/ }).click()
  await expect(page.locator('.document-toolbar')).toContainText('STORY')
})
