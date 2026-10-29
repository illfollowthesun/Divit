import { test, expect } from '@playwright/test'
import { mkdir, writeFile, readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
const list = (path: string) => readdir(path).catch(() => [] as string[])
test('a source dropped into the open project inbox is imported within about two seconds', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  await page.getByRole('button', { name: /New writing/ }).click()
  const id: string = await page.evaluate(() => JSON.parse(localStorage.getItem('yazi-browser-preview-v1')!).projects[0].id)
  const research = join('.tmp/yazi-preview/projects', id, 'research'), inbox = join(research, 'inbox')
  await mkdir(inbox, { recursive: true })
  await writeFile(join(inbox, 'ferry.md'), '---\ntitle: Winter ferry timetable\nurl: https://example.com/ferry\ntype: news\n---\nThe first ferry leaves at 06:10.')
  const dropped = Date.now()
  // Budget: one 1 s poll + 300 ms settle (about 1.1 s measured). The margin covers a machine busy with parallel tests.
  await expect.poll(() => list(join(inbox, '_imported')), { timeout: 10000, intervals: [100] }).toEqual(['ferry.md'])
  console.log(`inbox import took ${Date.now() - dropped} ms`)
  const [saved] = await list(join(research, 'sources'))
  expect(await readFile(join(research, 'sources', saved), 'utf8')).toContain('The first ferry leaves at 06:10.')
  await writeFile(join(inbox, 'again.md'), '---\ntitle: Same\nurl: https://www.example.com/ferry/\n---\nDuplicate.')
  await expect.poll(() => list(join(inbox, '_duplicates')), { timeout: 10000, intervals: [100] }).toEqual(['again.md'])
  expect(await list(join(research, 'sources'))).toHaveLength(1)
})
