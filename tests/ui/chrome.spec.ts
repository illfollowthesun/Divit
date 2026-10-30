import { test, expect } from '@playwright/test'
import { startMenu } from './shell-helpers'
test('project chrome is quiet, hides in focus and reveals at the top or with keyboard focus', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  await startMenu(page, 'New story or book'); await page.getByLabel('Project title').fill('Chrome test')
  await page.getByRole('button', { name: 'Create project', exact: true }).click()
  await expect(page.locator('.document-toolbar .accent-button')).toHaveCount(0)
  await page.keyboard.press('Control+.'); await page.mouse.move(600, 500)
  await expect.poll(() => page.locator('.document-toolbar').evaluate(el => getComputedStyle(el).opacity)).toBe('0')
  await page.mouse.move(300, 4)
  await expect.poll(() => page.locator('.document-toolbar').evaluate(el => getComputedStyle(el).opacity)).toBe('1')
  await page.mouse.move(600, 500); await page.keyboard.press('Control+Alt+t')
  await page.getByRole('textbox', { name: 'Markdown text' }).fill('A first line.\n\nA second line.')
  await expect.poll(() => page.evaluate(() => {
    const paper = document.querySelector('.paper')!, range = getSelection()?.getRangeAt(0)
    return range ? Math.abs(range.getBoundingClientRect().top-paper.getBoundingClientRect().top-paper.clientHeight*.45) : 999
  })).toBeLessThan(35)
  expect(await page.locator('.cm-content').evaluate(el => getComputedStyle(el).paddingTop)).toBe('0px')
  await page.keyboard.press('Control+Alt+t'); await page.keyboard.press('Escape')
})
