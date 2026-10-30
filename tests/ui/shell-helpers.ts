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
