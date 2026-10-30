import type { Page } from '@playwright/test'

// Toolbar actions that live in the More menu (Underlines, Snapshots, Start a rewrite, Archive).
export async function more(page: Page, name: string) {
  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('menu', { name: 'More actions' }).getByText(name, { exact: true }).click()
}
// Opens the place / date / tags / language fields under the title (a quiet summary line until opened).
export async function details(page: Page) {
  const summary = page.locator('.metadata-summary')
  if (await summary.getAttribute('aria-expanded') !== 'true') await summary.click()
}
// "New story or book" and "Bring in writing…" live in the small menu beside New writing.
export async function startMenu(page: Page, name: 'New story or book' | 'Bring in writing…') {
  await page.getByRole('button', { name: 'More ways to start' }).click()
  await page.getByRole('menu', { name: 'More ways to start' }).getByText(name, { exact: true }).click()
}
// Settings is split into side tabs; fields outside the open tab are hidden.
export async function settingsTab(page: Page, name: 'General' | 'Writing' | 'Appearance' | 'Your files' | 'AI' | 'About') {
  await page.getByRole('dialog').getByRole('tab', { name, exact: true }).click()
}
