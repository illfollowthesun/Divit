import type { Page } from '@playwright/test'

// Toolbar actions that live in the More menu (Underlines, Snapshots, Start a rewrite, Archive).
export async function more(page: Page, name: string) {
  await page.getByRole('button', { name: 'More actions' }).click()
  await page.getByRole('menu', { name: 'More actions' }).getByText(name, { exact: true }).click()
}
