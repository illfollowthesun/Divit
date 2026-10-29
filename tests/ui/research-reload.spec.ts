import { test, expect } from '@playwright/test'
import { select, projectId, dropSource } from './research-helpers'

test('a delayed research load cannot replace a newly saved highlight', async ({ page }) => {
  let release!: () => void, captured!: () => void
  const hold = new Promise<void>(resolve => { release = resolve })
  const ready = new Promise<void>(resolve => { captured = resolve })
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  await page.getByRole('button', { name: /New writing/ }).click()
  const id = await projectId(page)
  await dropSource(id, 'reload.md', '---\ntitle: Reload isolation\ntype: other\n---\nİlk vapur sabah kalkıyor.')
  await page.getByRole('button', { name: /^Research/ }).click()
  const drawer = page.getByRole('complementary', { name: 'Research' })
  await expect(drawer.getByRole('button', { name: /Reload isolation/ })).toBeVisible()
  let held = false
  await page.route('**/__yazi/research', async route => {
    const request = route.request().postDataJSON()
    if (request.projectId === id && request.action === 'load' && !held) {
      held = true
      const response = await route.fetch()
      captured(); await hold
      await route.fulfill({ response })
    } else await route.continue()
  })
  try {
    await drawer.getByRole('button', { name: /Reload isolation/ }).click()
    await ready // Hold the reload triggered by marking this source read, before any highlight exists.
    await expect(drawer.locator('.source-text')).toContainText('İlk vapur sabah kalkıyor.')
    await select(page, 'İlk vapur')
    await page.getByRole('button', { name: 'Highlight in Sage', exact: true }).click()
    await expect(drawer.locator('mark.hl-2')).toHaveText('İlk vapur')
    const delivered = page.waitForResponse(response => response.url().includes('/__yazi/research') && response.request().postDataJSON()?.action === 'load')
    release(); await (await delivered).finished()
    // Drain rendering after delivering the older response, rather than sleeping for a fixed delay.
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    await expect(drawer.locator('mark.hl-2')).toHaveText('İlk vapur')
  } finally { release() }
})
