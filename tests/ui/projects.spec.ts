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

test('chapters and scenes keep independent text and can be set aside and restored', async ({ page }) => {
  await page.getByRole('button', { name: /New story or book/ }).click()
  await page.getByLabel('Project type').selectOption('book'); await page.getByLabel('Project title').fill('The Last Ferry')
  await page.getByRole('button', { name: 'Create project', exact: true }).click()
  await page.getByRole('button', { name: '+ Chapter', exact: true }).click()
  await page.getByLabel('Section title').fill('The harbour')
  await page.getByRole('textbox', { name: 'Markdown text' }).fill('A chapter begins by the water.')
  await page.getByRole('button', { name: '+ Scene', exact: true }).click()
  await page.getByLabel('Section title').fill('The crossing')
  await page.getByRole('textbox', { name: 'Markdown text' }).fill('The ferry left before dawn.')
  await page.locator('.outline-node').filter({ hasText: 'The harbour' }).click()
  await expect(page.getByRole('textbox', { name: 'Markdown text' })).toContainText('A chapter begins')
  await page.getByRole('button', { name: 'Set aside', exact: true }).click()
  await expect(page.locator('.outline-tree')).not.toContainText('The crossing')
  await page.locator('.outline-trash summary').click()
  await page.locator('.outline-trash').getByRole('button', { name: 'Restore', exact: true }).click()
  await page.locator('.outline-node').filter({ hasText: 'The crossing' }).click()
  await expect(page.getByRole('textbox', { name: 'Markdown text' })).toContainText('The ferry left before dawn.')
  await page.keyboard.press('Control+s'); await expect(page.getByRole('status')).toHaveText('All changes saved')
  await page.reload(); await page.locator('.outline-node').filter({ hasText: 'The crossing' }).click()
  await expect(page.getByRole('textbox', { name: 'Markdown text' })).toContainText('The ferry left before dawn.')
})
