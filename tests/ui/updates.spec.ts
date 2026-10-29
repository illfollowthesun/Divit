import { test, expect } from '@playwright/test'
import { desktopBridge, nativeCalls } from './desktop-bridge'

test('a found update is only installed after the writer clicks Install and restart', async ({ page }) => {
  await desktopBridge(page, { config: {}, update: { rid: 7, currentVersion: '0.1.0-beta.1', version: '0.1.0-beta.2', date: '2026-11-20T10:00:00Z', body: 'Small fixes.', rawJson: {} } })
  await page.goto('/'); await page.getByRole('button', { name: 'Open settings' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByLabel('Check for a new version when Divit starts')).toBeChecked()
  await expect(dialog).toContainText('nothing about you or your writing is sent')
  await dialog.getByRole('button', { name: 'Check for updates' }).click()
  await expect(dialog.locator('.settings-updates [role=status]')).toHaveText('Version 0.1.0-beta.2 is available.')
  expect((await nativeCalls(page)).map(c => c.cmd).filter(c => c.startsWith('plugin:updater') || c.startsWith('plugin:process'))).toEqual(['plugin:updater|check'])
  await dialog.getByRole('button', { name: 'Close dialog' }).click()
  const banner = page.locator('.update-banner')
  await expect(banner).toContainText('Divit 0.1.0-beta.2 is ready.')
  await banner.getByRole('button', { name: 'Install and restart' }).click()
  await expect.poll(async () => (await nativeCalls(page)).map(c => c.cmd).filter(c => c.startsWith('plugin:updater|download') || c.startsWith('plugin:process'))).toEqual(['plugin:updater|download_and_install', 'plugin:process|restart'])
})

test('Later dismisses the update, and turning checks off is saved', async ({ page }) => {
  await desktopBridge(page, { config: {}, update: { rid: 7, currentVersion: '0.1.0-beta.1', version: '0.1.0-beta.2', date: '', body: '', rawJson: {} } })
  await page.goto('/'); await page.getByRole('button', { name: 'Open settings' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByRole('button', { name: 'Check for updates' }).click()
  await dialog.getByLabel('Check for a new version when Divit starts').uncheck()
  await dialog.getByRole('button', { name: 'Save settings' }).click()
  await page.locator('.update-banner').getByRole('button', { name: 'Later' }).click()
  await expect(page.locator('.update-banner')).toHaveCount(0)
  const saved = (await nativeCalls(page)).filter(c => c.cmd === 'save_settings').map(c => (c.args.data as { checkUpdates?: boolean }).checkUpdates)
  expect(saved).toEqual([false])
})
