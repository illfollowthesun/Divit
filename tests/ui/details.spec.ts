import { test, expect } from '@playwright/test'
test('ISO date, a thin accessible goal and key chips remain consistent',async({page})=>{
  await page.goto('/');await page.evaluate(()=>localStorage.clear());await page.reload()
  await page.getByRole('button',{name:/New story or book/}).click();await page.getByRole('button',{name:'Create project',exact:true}).click()
  const date=page.getByLabel('DATE',{exact:true});await expect(date).toHaveAttribute('type','text')
  await date.fill('2026-11-03');await page.getByRole('textbox',{name:'Markdown text'}).fill('One quiet morning.')
  await expect(page.getByRole('progressbar',{name:'Daily word goal',exact:true})).toHaveAttribute('value','3')
  await expect(page.locator('.editor-footer kbd')).toBeVisible()
  await page.keyboard.press('Control+s');await expect(page.getByRole('status')).toHaveText('All changes saved')
  await page.reload();await expect(date).toHaveValue('2026-11-03')
})
