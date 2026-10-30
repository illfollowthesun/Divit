import { test, expect } from '@playwright/test'
import { startMenu } from './shell-helpers'
test('clicking Derya, Çağla and İlker opens compact cards without editing text', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  await startMenu(page, 'New story or book'); await page.getByLabel('Project title').fill('Names')
  await page.getByRole('button', { name: 'Create project', exact: true }).click()
  const text = 'Derya, Çağla ve İlker vapuru bekliyordu.'
  await page.getByRole('textbox', { name: 'Markdown text' }).fill(text)
  await page.getByRole('tab', { name: 'Cards', exact: true }).click()
  for (const name of ['Derya','Çağla','İlker']) {
    await page.getByRole('button', { name: '+ Character', exact: true }).click(); await page.getByLabel('Card name').fill(name)
    await page.getByLabel('Details', { exact: true }).fill('A small detail. '.repeat(30)); await page.getByRole('button', { name: 'Save card', exact: true }).click()
  }
  for (const name of ['Derya','Çağla','İlker']) {
    await page.getByRole('tab', { name: 'Preview', exact: true }).click()
    await page.getByRole('link', { name: `Open card for ${name}`, exact: true }).click()
    await expect(page.locator('.card-selected h3')).toHaveText(name)
    expect(await page.locator('.card-selected .card-details').evaluate(el => getComputedStyle(el).fontSize)).toBe('14px')
    await page.locator('.card-selected').getByRole('button', { name: 'More', exact: true }).click()
    await expect(page.locator('.card-selected .card-details')).toHaveText('A small detail. '.repeat(30).trim())
  }
  await page.keyboard.press('Control+s')
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('yazi-browser-preview-v1')!).projects[0].body)).toBe(text)
})
