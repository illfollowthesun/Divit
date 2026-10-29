import { test, expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { createServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import { randomUUID } from 'node:crypto'
import { readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { newProject } from '../../src/shared/types'

// Kept within this spec so it can be committed without the pre-existing settings bridge.
// Only AI is simulated; all research actions use the real server and real files.
async function researchDesktop(page: Page, fixture: { project: Record<string, unknown>; search?: unknown; searchError?: string; config?: Record<string, unknown>; keys?: Record<string, boolean> }) {
  await page.addInitScript(fixture => {
    const calls: { cmd: string; args: Record<string, unknown> }[] = []
    const config = { enabled: true, provider: 'gemini', model: 'gemini-3.8-flash', monthlyLimitUsd: null, usage: {}, ...fixture.config }
    const bridgeWindow = window as unknown as Record<string, unknown>
    bridgeWindow.__researchCalls = calls
    bridgeWindow.isTauri = true
    bridgeWindow.__TAURI_INTERNALS__ = {
      transformCallback: () => 1, unregisterCallback: () => {}, convertFileSrc: (path: string) => path,
      invoke: async (cmd: string, args: Record<string, unknown> = {}) => {
        calls.push({ cmd, args: structuredClone(args) })
        if (cmd === 'library') return { projects: [fixture.project], ideas: [], images: [], trash: [], dataRoot: 'Verification', settings: { schemaVersion: 1, theme: 'light', siteRepo: '', aiProvider: 'claude-code' } }
        if (cmd === 'save_project') return { ...(args.data as object), revision: 'verification' }
        if (cmd === 'ai_status') return { config, models: { gemini: [], anthropic: [] }, price: null, hasKey: { gemini: true, ...fixture.keys }, capabilities: { nativeSearch: config.provider === 'gemini' || config.provider === 'anthropic', keyRequired: config.provider !== 'local' } }
        if (cmd === 'ai_search') { if (fixture.searchError) throw fixture.searchError; return fixture.search }
        if (cmd === 'backup_action') return { enabled: false, lastBackupAt: null }
        if (cmd !== 'research_action') return null
        const response = await fetch('/__yazi/research', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Yazi-Preview': '1' }, body: JSON.stringify({ ...(args.payload as object), projectId: args.projectId, action: args.action }) })
        const result = await response.json()
        if (!response.ok) throw result.error
        return result
      },
    }
  }, fixture)
}
const nativeCalls = (page: Page): Promise<{ cmd: string; args: Record<string, unknown> }[]> => page.evaluate(() => (window as unknown as { __researchCalls: never }).__researchCalls)

const summary = 'AI summary: the first ferry leaves before sunrise.'
const candidate = (url: string, title = 'Suggested source') => ({ title, url, site: 'Harbour', published: '', type: 'other', summary, excerpt: '' })
const result = (urls: string[]) => ({ candidates: urls.map(url => candidate(url)), dropped: 1, usage: { inputTokens: 3100, outputTokens: 1100, webSearches: 2, costUsd: 0.00645, monthCostUsd: 0.00645, overLimit: false, model: 'gemini-3.8-flash' } })

async function openSearch(page: Page, options: { search?: unknown; searchError?: string; config?: Record<string, unknown>; keys?: Record<string, boolean> }) {
  const project = { ...newProject('Ferry research'), id: randomUUID(), mode: 'normal', language: 'tr', body: 'My manuscript stays as written.' }
  await researchDesktop(page, { ...options, project })
  await page.goto('/')
  await page.getByRole('button', { name: /Ferry research/ }).click()
  await page.getByRole('button', { name: /^Research/ }).click()
  const drawer = page.getByRole('complementary', { name: 'Research' })
  await drawer.getByRole('button', { name: 'Search about this topic' }).click()
  const form = drawer.getByRole('form', { name: 'Search about this topic' })
  await form.getByLabel('Topic', { exact: true }).fill('Winter ferries')
  await form.getByLabel('Angle', { exact: true }).fill('First departure')
  await form.getByLabel('Sources', { exact: true }).fill('3')
  return { project, drawer, form, folder: join('.tmp/yazi-preview/projects', project.id, 'research') }
}

test('AI suggestions fetch real pages only on Keep; summaries stay separate and the saved reader works offline', async ({ page }) => {
  const fetched: string[] = []
  const server = createServer((req, res) => {
    fetched.push(req.url!)
    if (req.url === '/broken') { res.writeHead(503); res.end('Unavailable'); return }
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end(`<html><head><title>Real ferry timetable</title><meta name="description" content="Publisher description"></head><body><article><h1>Real ferry timetable</h1>${Array.from({ length: 7 }, (_, i) => `<p>Verified paragraph ${i + 1}: the actual ferry timetable says departure is at 06:10. This text comes from the publisher, with details about winter sailings and the harbour.</p>`).join('')}</article></body></html>`)
  })
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve))
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  try {
    const { drawer, form, folder, project } = await openSearch(page, { search: result([`${base}/page`, `${base}/discard`, `${base}/broken`]) })
    expect((await nativeCalls(page)).filter(c => c.cmd === 'ai_search')).toHaveLength(0)
    await form.getByRole('button', { name: 'Search with AI', exact: true }).click()
    const cards = drawer.locator('.ai-candidate')
    await expect(cards).toHaveCount(3)
    await expect(cards.first().locator('.ai-summary')).toHaveText(`AI ${summary}`)
    await expect(drawer.locator('.ai-spend')).toContainText('3,100 in / 1,100 out tokens · 2 web searches')
    expect(fetched).toEqual([])
    await cards.nth(1).getByRole('button', { name: 'Discard', exact: true }).click()
    await expect(cards).toHaveCount(2)
    await cards.last().getByRole('button', { name: 'Keep', exact: true }).click()
    await expect(cards.last().getByRole('alert')).toContainText('Nothing was saved.')
    await expect(drawer.locator('.source-row')).toHaveCount(0)
    let failSummary = true
    await page.route('**/__yazi/research', async route => {
      if (failSummary && route.request().postDataJSON().action === 'save-annotations') {
        failSummary = false
        await route.fulfill({ status: 503, json: { error: 'Summary storage temporarily unavailable.' } })
      } else await route.continue()
    })
    await cards.first().getByRole('button', { name: 'Keep', exact: true }).click()
    await expect(cards.first().getByRole('alert')).toContainText('The page is saved. Retry Keep')
    await cards.first().getByRole('button', { name: 'Keep', exact: true }).click()
    await expect(cards.first()).toContainText('Kept: the page was saved')
    await cards.last().getByRole('button', { name: 'Discard', exact: true }).click()
    await drawer.getByRole('button', { name: 'Done', exact: true }).click()
    const index = JSON.parse(await readFile(join(folder, 'research.json'), 'utf8'))
    expect(index.sources).toHaveLength(1)
    expect(index.sources[0]).toMatchObject({ title: 'Real ferry timetable', origin: 'ai-found', topic: 'Winter ferries', url: `${base}/page` })
    expect(index.ai).toEqual([expect.objectContaining({ sourceId: index.sources[0].id, kind: 'summary', body: summary, provider: 'gemini', model: 'gemini-3.8-flash' })])
    const files = await readdir(join(folder, 'sources'))
    expect(files).toHaveLength(1)
    const saved = await readFile(join(folder, 'sources', files[0]), 'utf8')
    expect(saved).toContain('Verified paragraph 7')
    expect(saved).not.toContain(summary)
    expect(fetched).toEqual(['/broken', '/page'])
    const calls = await nativeCalls(page)
    expect(calls.find(c => c.cmd === 'ai_search')!.args.request).toMatchObject({ topic: 'Winter ferries', angle: 'First departure', language: 'tr', count: 3, projectTitle: project.title })
    expect(calls.filter(c => c.cmd === 'save_project').every(c => (c.args.data as { body: string }).body === project.body)).toBe(true)
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()))
    await page.reload()
    await page.getByRole('button', { name: /Ferry research/ }).click()
    await page.getByRole('button', { name: /^Research/ }).click()
    await drawer.getByRole('button', { name: /Real ferry timetable/ }).click()
    await expect(drawer.locator('.source-text')).toContainText('Verified paragraph 7')
    await expect(drawer.locator('.ai-summary')).toHaveText(`AI ${summary}`)
    await expect(page.getByRole('textbox', { name: 'Markdown text' })).toHaveText(project.body)
  } finally { if (server.listening) await new Promise<void>(resolve => server.close(() => resolve())) }
})

test('search errors retain the form and save no sources', async ({ page }) => {
  const { drawer, form } = await openSearch(page, { searchError: 'The provider rate limit was reached.' })
  await form.getByRole('button', { name: 'Search with AI', exact: true }).click()
  await expect(drawer.getByRole('alert')).toHaveText('The provider rate limit was reached.')
  await expect(form.getByLabel('Topic', { exact: true })).toHaveValue('Winter ferries')
  await expect(drawer.locator('.ai-candidate, .source-row')).toHaveCount(0)
  expect((await nativeCalls(page)).filter(c => c.cmd === 'research_action' && c.args.action === 'add-source')).toHaveLength(0)
})

test('a monthly soft limit asks before sending and Cancel spends nothing', async ({ page }) => {
  const month = new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 7)
  const { form, drawer } = await openSearch(page, { search: result([]), config: { monthlyLimitUsd: 1, usage: { month, calls: 2, inputTokens: 500, outputTokens: 100, webSearches: 1, costUsd: 2, unpricedCalls: 0 } } })
  await form.getByRole('button', { name: 'Search with AI', exact: true }).click()
  await expect(form.getByRole('alert')).toContainText('over your limit')
  await form.getByRole('alert').getByRole('button', { name: 'Cancel', exact: true }).click()
  expect((await nativeCalls(page)).filter(c => c.cmd === 'ai_search')).toHaveLength(0)
  await form.getByRole('button', { name: 'Search with AI', exact: true }).click()
  await form.getByRole('button', { name: 'Search anyway', exact: true }).click()
  await expect(drawer.locator('.ai-candidates')).toContainText('No sources came back.')
  expect((await nativeCalls(page)).filter(c => c.cmd === 'ai_search')).toHaveLength(1)
})

for (const [provider, keys] of [['gemini', { gemini: false }], ['local', {}]] as const) {
  test(`${provider} without web search keeps the manual request flow`, async ({ page }) => {
    const { drawer, form, folder } = await openSearch(page, { config: { provider }, keys })
    await expect(form.getByRole('button', { name: 'Search with AI', exact: true })).toHaveCount(0)
    await form.getByRole('button', { name: 'Save request', exact: true }).click()
    await expect(drawer.locator('.request-status')).toContainText('Waiting for sources')
    expect(await readdir(join(folder, 'requests'))).toHaveLength(1)
    expect((await nativeCalls(page)).filter(c => c.cmd === 'ai_search')).toHaveLength(0)
  })
}
