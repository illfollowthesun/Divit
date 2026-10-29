import type { Page } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

// Selects `phrase` inside the reader the way a mouse drag would, then releases the button.
export async function select(page: Page, phrase: string) {
  await page.evaluate(phrase => {
    // The phrase may run across a highlight and plain text, so search the joined text nodes.
    const root = document.querySelector('.source-text')!, walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT), nodes: Text[] = []
    while (walker.nextNode()) nodes.push(walker.currentNode as Text)
    const joined = nodes.map(n => n.data).join(''), at = joined.indexOf(phrase)
    if (at === -1) throw new Error(`Not found: ${phrase}`)
    // A start on a node boundary belongs to the next node, an end to the previous one.
    const locate = (offset: number, end: boolean) => { for (const node of nodes) { if (end ? offset <= node.data.length : offset < node.data.length) return [node, offset] as const; offset -= node.data.length } throw new Error('offset') }
    const range = document.createRange(); range.setStart(...locate(at, false)); range.setEnd(...locate(at + phrase.length, true))
    getSelection()!.removeAllRanges(); getSelection()!.addRange(range)
    root.dispatchEvent(new MouseEvent('mouseup', { bubbles: true }))
  }, phrase)
}
export const projectId = (page: Page): Promise<string> => page.evaluate(() => JSON.parse(localStorage.getItem('yazi-browser-preview-v1')!).projects[0].id)
export const researchFolder = (id: string) => join('.tmp/yazi-preview/projects', id, 'research')
export async function dropSource(id: string, name: string, file: string) {
  const inbox = join(researchFolder(id), 'inbox'); await mkdir(inbox, { recursive: true }); await writeFile(join(inbox, name), file)
}
