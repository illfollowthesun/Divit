import { test, expect } from '@playwright/test'
import { newProject } from '../../src/shared/types'
import { randomUUID } from 'node:crypto'
import { desktopBridge } from './desktop-bridge'
import { select } from './research-helpers'

for (const viewport of [{ width: 1440, height: 900 }, { width: 960, height: 700 }]) {
  test(`Settings component keeps drafts, keyboard tabs and footer at ${viewport.width}`, async ({ page }) => {
    await page.setViewportSize(viewport)
    await page.goto('/tests/ui/fixtures/settings.html')
    const save = page.getByRole('button', { name: 'Save settings' })
    await expect(save).toBeDisabled()
    await page.getByLabel('Interface language').selectOption('tr'); await expect(save).toBeEnabled()
    await page.getByRole('tab', { name: 'General', exact: true }).focus(); await page.keyboard.press('ArrowDown')
    await expect(page.getByRole('tab', { name: 'Writing', exact: true })).toBeFocused()
    await page.getByRole('tabpanel').evaluate(element => element.parentElement!.scrollTop = 10000)
    const box = await save.boundingBox(); expect(box!.y).toBeGreaterThan(0); expect(box!.y + box!.height).toBeLessThan(viewport.height)
    await page.getByRole('tab', { name: 'General', exact: true }).click(); await expect(page.getByLabel('Interface language')).toHaveValue('tr')
    await save.click(); await expect(save).toBeDisabled()
    await page.getByRole('button', { name: 'Cancel', exact: true }).click(); await expect(page.getByText('Closed', { exact: true })).toBeVisible()
  })

  test(`panel screenshots and spelling actions at ${viewport.width}`, async ({ page }) => {
    test.skip(!process.env.YAZI_PANELS_SHOTS, 'Set YAZI_PANELS_SHOTS=1 to capture invented samples.')
    await page.setViewportSize(viewport)
    const project = { ...newProject('The morning crossing', undefined, 'story'), id: randomUUID(), mode: 'normal', language: 'en', body: 'The first ferry left before the city woke. Mira counted the gulls on the raileing, as she always did, and lost count at nine.' }
    await desktopBridge(page, { config: { enabled: true }, projects: [project] })
    await page.goto('/'); await page.keyboard.press('Control+2')
    const review = page.getByRole('complementary', { name: 'Review issues' })
    await expect(review.getByRole('button', { name: 'Replace raileing with railing', exact: true })).toBeVisible({ timeout: 15000 })
    await expect(review.getByText('raileing', { exact: true })).toHaveCount(1)
    await expect(review.getByText(/Local spelling/)).toHaveCount(1)
    await expect(review.getByRole('button', { name: 'Ignore once' })).toBeVisible()
    await page.screenshot({ path: `docs/screenshots/tidy-after-panels-review-${viewport.width}x${viewport.height}.png` })
    await page.keyboard.press('Control+3')
    await page.evaluate(async projectId => {
      const response = await fetch('/__yazi/research', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Yazi-Preview': '1' }, body: JSON.stringify({ projectId, action: 'add-source', meta: { title: 'The morning crossing', site: 'Harbour Notes', url: 'https://example.com/crossing', summary: 'The first boat of the day leaves at ten past six in winter.' }, text: 'The first boat of the day leaves at ten past six in winter.\n\nRegular passengers keep to the same seats, and the crew learn their faces within a week.\n\nGulls follow the wake until the boat clears the breakwater.' }) })
      if (!response.ok) throw new Error(await response.text())
    }, project.id)
    await page.reload()
    await expect(page.getByLabel('Title', { exact: true })).toHaveValue('The morning crossing')
    await page.getByRole('button', { name: /^Research/ }).click()
    const drawer = page.getByRole('complementary', { name: 'Research', exact: true })
    await drawer.getByRole('button', { name: /The morning crossing/ }).click()
    await expect(drawer.locator('.source-text')).toContainText('Regular passengers')
    await expect(drawer.locator('.source-ai-details p')).toBeHidden()
    await select(page, 'Regular passengers keep to the same seats')
    await page.getByRole('dialog', { name: 'Highlight selection' }).getByRole('button', { name: 'Highlight in Sage' }).click()
    await expect(drawer.locator('mark')).toBeVisible()
    await page.screenshot({ path: `docs/screenshots/tidy-after-panels-research-${viewport.width}x${viewport.height}.png` })
    await page.keyboard.press('Escape'); await page.getByRole('button', { name: 'Open settings' }).click()
    await page.getByRole('dialog').getByRole('tab', { name: 'AI', exact: true }).click() // Settings is tabbed since the merge
    await page.screenshot({ path: `docs/screenshots/tidy-after-panels-ai-${viewport.width}x${viewport.height}.png` })
  })
}
