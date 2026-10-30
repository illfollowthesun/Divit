import { test, expect } from '@playwright/test'
import { details, startMenu } from './shell-helpers'
test('ISO date, a thin accessible goal and key chips remain consistent',async({page})=>{
  await page.goto('/');await page.evaluate(()=>localStorage.clear());await page.reload()
  await startMenu(page, 'New story or book');await page.getByRole('button',{name:'Create project',exact:true}).click()
  await details(page); const date=page.getByLabel('DATE',{exact:true});await expect(date).toHaveAttribute('type','text')
  // The daily goal is off by default; turn it on to see the thin progress line.
  await page.getByRole('button',{name:'Open settings'}).click();await page.getByRole('dialog').getByLabel('Daily writing goal').fill('500');await page.getByRole('button',{name:'Save settings'}).click()
  await date.fill('2026-11-03');await page.getByRole('textbox',{name:'Markdown text'}).fill('One quiet morning.')
  await expect(page.getByRole('progressbar',{name:'Words written today',exact:true})).toHaveAttribute('value','3')
  await expect(page.locator('.new-button kbd')).toBeVisible(); await expect(page.locator('.editor-footer kbd')).toHaveCount(0) // the Focus hint lives in the shortcut sheet
  await page.keyboard.press('Control+s');await expect(page.getByRole('status')).toHaveText('All changes saved')
  await page.reload();await details(page);await expect(date).toHaveValue('2026-11-03')
})
