import {test,expect} from '@playwright/test'
test('EN/TR project language persists and updates native spellcheck without correcting text',async({page})=>{
  await page.goto('/');await page.evaluate(()=>localStorage.clear());await page.reload();await page.getByRole('button',{name:/New writing/}).click()
  const editor=page.getByRole('textbox',{name:'Markdown text'}),text='İlker Türkçe yazıyorr. A misspelld word.'
  await editor.fill(text);await expect(editor).toHaveAttribute('lang','en')
  await page.getByRole('combobox',{name:'LANGUAGE',exact:true}).selectOption('tr')
  await expect(editor).toHaveAttribute('lang','tr');await expect(editor).toHaveAttribute('spellcheck','true');await expect(editor).toHaveAttribute('autocorrect','off')
  await page.keyboard.press('Control+s');await expect(page.getByRole('status')).toHaveText('All changes saved');await page.reload()
  await expect(editor).toHaveAttribute('lang','tr')
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('yazi-browser-preview-v1')!).projects[0].body)).toBe(text)
  await page.getByRole('combobox',{name:'LANGUAGE',exact:true}).selectOption('en');await expect(editor).toHaveAttribute('lang','en')
})
