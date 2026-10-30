import {test,expect} from '@playwright/test'
import { settingsTab } from './shell-helpers'
test('backup settings show the folder and last status without touching Documents in preview',async({page})=>{
  await page.goto('/');await page.getByRole('button',{name:'Open settings'}).click(); await settingsTab(page, 'Your files')
  await expect(page.locator('.backup-status')).toContainText('Last backup: not configured')
  await expect(page.getByRole('button',{name:'Choose backup folder',exact:true})).toBeDisabled()
  await expect(page.getByRole('button',{name:'Back up now',exact:true})).toBeDisabled()
  await expect(page.getByRole('dialog')).toContainText('14 latest ZIPs')
})
