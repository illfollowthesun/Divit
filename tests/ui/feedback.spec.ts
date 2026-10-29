import { test, expect } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { newProject } from '../../src/shared/types'
import { desktopBridge, nativeCalls } from './desktop-bridge'

test('Help opens feedback and bug issues in the browser with version and Windows details, never the writing', async ({ page }) => {
  const body = 'A private sentence that must stay on this computer.'
  await desktopBridge(page, { config: {}, projects: [{ ...newProject('Private draft'), id: randomUUID(), mode: 'normal', body }] })
  await page.goto('/'); await expect(page.getByLabel('Title')).toHaveValue('Private draft'); await page.getByRole('button', { name: /Keyboard shortcuts/ }).click()
  const help = page.getByRole('dialog', { name: 'A few familiar keys' })
  await expect(help).toContainText('Your writing is never included.')
  await help.getByRole('button', { name: 'Report a bug ↗' }).click()
  await help.getByRole('button', { name: 'Send feedback ↗' }).click()
  await expect.poll(async () => (await nativeCalls(page)).filter(c => c.cmd === 'plugin:opener|open_url').length).toBe(2)
  const urls = (await nativeCalls(page)).filter(c => c.cmd === 'plugin:opener|open_url').map(c => new URL(c.args.url as string))
  expect(urls.map(u => u.searchParams.get('labels'))).toEqual(['bug', 'feedback'])
  expect(urls[0].searchParams.get('body')).toContain('**App version:** 0.1.0-beta.1')
  for (const url of urls) { expect(url.href.startsWith('https://github.com/Firextream/Yazi/issues/new?')).toBe(true); expect(decodeURIComponent(url.href)).not.toContain('private sentence') }
})
