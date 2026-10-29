import { test, expect } from '@playwright/test'
test('a large Turkish source round-trips through the preview endpoint unchanged', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  await page.getByRole('button', { name: /New writing/ }).click()
  const result = await page.evaluate(async () => {
    const projectId = JSON.parse(localStorage.getItem('yazi-browser-preview-v1')!).projects[0].id
    const call = (body: object) => fetch('/__yazi/research', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Yazi-Preview': '1' }, body: JSON.stringify({ projectId, ...body }) }).then(r => r.json())
    // About 600 KB of text with two-byte Turkish letters.
    const text = 'İğneada’da ışık, çay ve şarkı; Üsküdar’a gidelim. '.repeat(12000).trim()
    const added = await call({ action: 'add-source', meta: { title: 'Uzun kaynak' }, text })
    const read = await call({ action: 'read-source', sourceId: added.source.id })
    return { same: read.text === text, length: read.text.length }
  })
  expect(result).toEqual({ same: true, length: expect.any(Number) })
})
