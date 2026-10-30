import{test,expect}from'@playwright/test'
import { more } from './shell-helpers'
test('snapshots render headings, highlight word changes and filter unchanged blocks safely',async({page})=>{
  await page.goto('/');await page.evaluate(()=>localStorage.clear());await page.reload();await page.getByRole('button',{name:/New story or book/}).click()
  await page.getByRole('button',{name:'Create project',exact:true}).click()
  const editor=page.getByRole('textbox',{name:'Markdown text'})
  await editor.fill('## Karaköy\n\nÇağla eski defteri açtı.\n\nA quiet unchanged paragraph.')
  await more(page, 'Start a rewrite')
  await editor.fill('## Karaköy\n\nÇağla yeni defteri açtı.\n\nA quiet unchanged paragraph.\n\n<script>window.pwned=true</script>')
  await more(page, 'Snapshots')
  await expect(page.locator('.snapshot-document h2').first()).toHaveText('Karaköy')
  await expect(page.locator('.snapshot-document .diff-removed')).toContainText('eski')
  await expect(page.locator('.snapshot-document .diff-added').first()).toContainText('yeni')
  await expect(page.locator('.snapshot-document script')).toHaveCount(0)
  await page.getByLabel('Only show changes').check()
  await expect(page.locator('.snapshot-comparison')).not.toContainText('A quiet unchanged paragraph.')
  expect(await page.evaluate(()=>'pwned'in window)).toBe(false)
})
