import { test, expect, type Page } from '@playwright/test'
import { startMenu } from './shell-helpers'

async function book(page: Page) {
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  await startMenu(page, 'New story or book'); await page.getByLabel('Project title').fill('Companion test')
  await page.getByRole('button', { name: 'Create project', exact: true }).click()
}
const paragraphs = Array.from({ length: 35 }, (_, i) => `Paragraph ${i + 1}. A little more of the story.`).join('\n\n')

test('the companion can be put away at full width, keeps the text readable and is remembered', async ({ page }) => {
  await book(page)
  const companion = page.getByRole('complementary', { name: 'Writing companion' })
  const toggle = page.locator('.document-toolbar').getByRole('button', { name: 'Side panel', exact: true })
  await expect(companion).toBeVisible(); await expect(toggle).toHaveAttribute('aria-pressed', 'true')
  await toggle.click()
  await expect(companion).toBeHidden(); await expect(toggle).toHaveAttribute('aria-pressed', 'false')
  expect((await page.locator('.markdown-editor').boundingBox())!.width).toBeLessThanOrEqual(800)
  await page.keyboard.press('Control+s'); await expect(page.locator('.save-state')).toHaveText('Saved')
  await page.reload(); await expect(page.getByRole('textbox', { name: 'Markdown text' })).toBeVisible(); await expect(companion).toBeHidden()
  await page.keyboard.press('Control+Alt+k')
  await expect(companion).toBeVisible(); await expect(page.getByRole('button', { name: '+ Character', exact: true })).toBeVisible()
  await page.keyboard.press('Control+Alt+p'); await expect(companion).toBeHidden()
})

test('Focus starts with the page alone; the companion returns on request and Escape steps out in order', async ({ page }) => {
  await book(page)
  const editor = page.getByRole('textbox', { name: 'Markdown text' }), companion = page.getByRole('complementary', { name: 'Writing companion' })
  await editor.fill('A first line.')
  await page.locator('.document-toolbar').getByRole('button', { name: 'Focus', exact: true }).click(); await page.mouse.move(600, 500)
  await expect(companion).toBeHidden(); await expect(page.getByRole('complementary', { name: 'Writing library' })).toBeHidden(); await expect(editor).toBeFocused()
  await page.keyboard.press('Control+Alt+p'); await expect(companion).toBeVisible()
  const area = (await page.locator('.writing-area').boundingBox())!, text = (await page.locator('.markdown-editor').boundingBox())!
  expect(text.width).toBeGreaterThanOrEqual(560)
  expect(Math.abs((text.x - area.x) - (area.x + area.width - text.x - text.width))).toBeLessThan(4)
  await page.mouse.move(300, 4)
  await expect.poll(() => page.locator('.document-toolbar').evaluate(el => getComputedStyle(el).opacity)).toBe('1')
  const bar = (await page.locator('.document-toolbar').boundingBox())!, panel = (await companion.boundingBox())!
  expect(bar.x + bar.width).toBeLessThanOrEqual(panel.x + 1)
  await page.mouse.move(600, 500); await editor.click()
  await page.keyboard.press('Escape')
  await expect(companion).toBeHidden(); await expect(page.locator('.app')).toHaveClass(/focus-mode/); await expect(editor).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.locator('.app')).not.toHaveClass(/focus-mode/); await expect(companion).toBeVisible()
})

test('Typewriter keeps the bars, does not pull the page on a click and is remembered', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  await page.getByRole('button', { name: /New writing/ }).click()
  const editor = page.getByRole('textbox', { name: 'Markdown text' }), typewriter = page.getByRole('button', { name: 'Typewriter', exact: true })
  await editor.fill(paragraphs); await editor.press('Control+End')
  await typewriter.click(); await page.mouse.move(600, 500)
  await expect(page.getByRole('banner')).toBeInViewport(); await expect(page.getByRole('complementary', { name: 'Writing library' })).toBeVisible()
  expect(await page.locator('.document-toolbar').evaluate(el => getComputedStyle(el).opacity)).toBe('1')
  const offset = () => page.evaluate(() => {
    const paper = document.querySelector('.paper')!, range = getSelection()?.rangeCount ? getSelection()!.getRangeAt(0) : null
    return range ? Math.abs(range.getBoundingClientRect().top - paper.getBoundingClientRect().top - paper.clientHeight * .45) : 999
  })
  await expect.poll(offset).toBeLessThan(35)
  const scroll = () => page.locator('.paper').evaluate(el => el.scrollTop), before = await scroll(), box = (await page.locator('.paper').boundingBox())!
  await page.mouse.click(box.x + box.width / 2, box.y + 90); await page.waitForTimeout(300)
  expect(await scroll()).toBe(before)
  await editor.press('ArrowRight'); await expect.poll(offset).toBeLessThan(35); expect(await scroll()).toBeLessThan(before)
  await page.reload(); await expect(typewriter).toHaveAttribute('aria-pressed', 'true')
})

test('in a narrow window Focus keeps the companion one hover or one shortcut away', async ({ page }) => {
  await page.setViewportSize({ width: 1000, height: 800 }); await book(page)
  const companion = page.getByRole('complementary', { name: 'Writing companion' }), edge = page.getByRole('button', { name: 'Toggle companion', exact: true })
  await page.keyboard.press('Control+.'); await page.mouse.move(400, 500)
  await expect(companion).toBeHidden(); await expect(edge).toHaveCSS('opacity', '0')
  await edge.hover(); await expect(edge).toHaveCSS('opacity', '1'); await edge.click(); await expect(companion).toBeVisible()
  expect((await companion.boundingBox())!.y).toBeLessThan(40)
  await page.keyboard.press('Escape'); await expect(companion).toBeHidden(); await expect(page.locator('.app')).toHaveClass(/focus-mode/)
})