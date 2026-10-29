import { test, expect } from '@playwright/test'
import { desktopBridge, nativeCalls } from './desktop-bridge'

test('moving the library warns about two computers, copies only after confirming and keeps the old folder', async ({ page }) => {
  await desktopBridge(page, { config: {}, extra: {
    'plugin:dialog|open': 'D:\OneDrive',
    library_location: { root: 'D:\OneDrive\Yazi', existing: false, projects: 0, changedAt: null },
    library_move: { dataRoot: 'D:\OneDrive\Yazi', previous: 'C:\Users\writer\Documents\Yazi', copied: 12 },
  } })
  await page.goto('/'); await page.getByRole('button', { name: 'Open settings' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('C:/Users/writer/Documents/Yazi')
  await dialog.getByRole('button', { name: 'Move library…' }).click()
  const plan = dialog.getByRole('group', { name: 'Move library' })
  await expect(plan).toContainText('Only one computer should have the app open on this library at a time.')
  await expect(plan).toContainText('Your library will be copied to D:\OneDrive\Yazi, each file checked')
  expect((await nativeCalls(page)).some(c => c.cmd === 'library_move')).toBe(false)
  await plan.getByRole('button', { name: 'Move here' }).click()
  await expect(dialog.getByRole('status').filter({ hasText: 'Your library is now in' })).toContainText('The old folder was kept at C:\Users\writer\Documents\Yazi')
  expect((await nativeCalls(page)).find(c => c.cmd === 'library_move')?.args).toEqual({ target: 'D:\OneDrive', mode: 'move' })
})

test('a folder that already holds a library is offered for use, not overwritten', async ({ page }) => {
  await desktopBridge(page, { config: {}, extra: { 'plugin:dialog|open': 'D:\Dropbox', library_location: { root: 'D:\Dropbox\Yazi', existing: true, projects: 4, changedAt: Date.UTC(2026, 9, 29, 9, 30) } } })
  await page.goto('/'); await page.getByRole('button', { name: 'Open settings' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Move library…' }).click()
  const plan = dialog.getByRole('group', { name: 'Move library' })
  await expect(plan).toContainText('There is already a library in D:\Dropbox\Yazi with 4 projects')
  await expect(plan.getByRole('button', { name: 'Use this library' })).toBeVisible()
  await expect(plan.getByRole('button', { name: 'Move here' })).toHaveCount(0)
})
