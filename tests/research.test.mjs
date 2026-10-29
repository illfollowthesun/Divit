import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, readFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { parseSource, serializeSource, normalizeUrl, cleanMeta } from '../scripts/research-format.mjs'
import { research, fetchPage, queued } from '../scripts/research-bridge.mjs'
import { createServer } from 'node:http'
await mkdir('.tmp', { recursive: true })
test('pages are fetched with their declared charset, redirects followed and limits enforced', async t => {
  const turkish = Buffer.from([0x49, 0x73, 0x74, 0x61, 0x6e, 0x62, 0x75, 0x6c, 0x27, 0x64, 0x61, 0x20, 0xfd, 0xfe, 0xf0]) // "Istanbul'da ışğ" in windows-1254
  const server = createServer((req, res) => {
    if (req.url === '/tr') { res.writeHead(200, { 'Content-Type': 'text/html; charset=windows-1254' }); res.end(Buffer.concat([Buffer.from('<p>'), turkish, Buffer.from('</p>')])) }
    else if (req.url === '/meta') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(Buffer.concat([Buffer.from('<meta charset="windows-1254"><p>'), turkish])) }
    else if (req.url === '/move') { res.writeHead(301, { Location: '/tr' }); res.end() }
    else if (req.url === '/pdf') { res.writeHead(200, { 'Content-Type': 'application/pdf' }); res.end('%PDF') }
    else if (req.url === '/big') { res.writeHead(200, { 'Content-Type': 'text/html' }); res.end(Buffer.alloc(6 * 1024 * 1024, 32)) }
    else if (req.url === '/slow') { setTimeout(() => res.end('late'), 2000) }
    else { res.writeHead(404); res.end() }
  }).listen(0, '127.0.0.1')
  t.after(() => server.close())
  await new Promise(resolve => server.once('listening', resolve))
  const base = `http://127.0.0.1:${server.address().port}`
  assert.equal((await fetchPage(`${base}/tr`)).html, "<p>Istanbul'da ışğ</p>")
  assert.match((await fetchPage(`${base}/meta`)).html, /ışğ$/)
  const moved = await fetchPage(`${base}/move`); assert.equal(moved.url, `${base}/tr`)
  await assert.rejects(fetchPage(`${base}/pdf`), /PDFs/)
  await assert.rejects(fetchPage(`${base}/big`), /too large/)
  await assert.rejects(fetchPage(`${base}/missing`), /error \(404\)/)
  await assert.rejects(fetchPage(`${base}/slow`, { timeoutMs: 200 }), /too long/)
  await assert.rejects(fetchPage('file:///C:/Windows/win.ini'), /Only http/)
  await assert.rejects(fetchPage('not a url'), /full web address/)
})
async function project() {
  const dataRoot = await mkdtemp(join(process.cwd(), '.tmp/research-')), projectId = 'project-1'
  await mkdir(join(dataRoot, 'projects', projectId), { recursive: true })
  return { dataRoot, projectId }
}
test('source files round-trip frontmatter and keep the original wording exactly', () => {
  const meta = { title: 'Ferries: a history', url: 'https://example.com/a?b=1', site: 'Example', author: "O'Brien", published: '2026-10-20', type: 'article', topic: 'Istanbul ferries', summary: 'Line one\nline two. "Quoted" # not a comment' }
  const text = '## Karaköy\n\nÇağla’nın vapuru — 06:10.\n\n> A quote: kept.'
  const parsed = parseSource(serializeSource(meta, text))
  assert.deepEqual(parsed.meta, { ...meta, summary: 'Line one line two. "Quoted" # not a comment' }); assert.equal(parsed.text, text)
  assert.deepEqual(parseSource('---\r\ntitle: \'It\'\'s\'\r\ntype: news\r\n---\r\nBody').meta, { title: "It's", type: 'news' })
  assert.deepEqual(parseSource('No frontmatter here.'), { meta: {}, text: 'No frontmatter here.' })
})
test('URLs dedupe across tracking parameters, fragments, www and trailing slashes', () => {
  assert.equal(normalizeUrl('https://WWW.Example.com/news/?utm_source=x&b=2&a=1#top'), normalizeUrl('https://example.com/news?a=1&b=2'))
  assert.notEqual(normalizeUrl('https://example.com/news?id=1'), normalizeUrl('https://example.com/news?id=2'))
  assert.equal(normalizeUrl('javascript:alert(1)'), ''); assert.equal(normalizeUrl('not a url'), '')
  assert.equal(cleanMeta({ title: '  ' }), null)
  assert.deepEqual(cleanMeta({ title: 'T', type: 'tweet', url: 'file:///c:/x', extra: 'x' }), { title: 'T', type: 'other' })
})
test('sources are saved as readable files, deduplicated by URL, and annotations stay separate', async () => {
  const p = await project(), now = new Date('2026-10-29T10:00:00Z')
  const first = await research({ ...p, action: 'add-source', meta: { title: 'Ferry timetable', url: 'https://example.com/ferry', type: 'news' }, text: 'Winter: 06:10.' }, { now })
  assert.equal(first.duplicate, false); assert.equal(first.source.status, 'unread'); assert.equal(first.source.saved, '2026-10-29')
  const file = await readFile(join(p.dataRoot, 'projects/project-1/research/sources', `${first.source.id}.md`), 'utf8')
  assert.match(file, /^---\ntitle: Ferry timetable\nurl: https:\/\/example.com\/ferry\nsaved: 2026-10-29\ntype: news\n---\n\nWinter: 06:10.\n$/)
  const again = await research({ ...p, action: 'add-source', meta: { title: 'Other title', url: 'https://www.example.com/ferry/#x' }, text: 'Different' })
  assert.equal(again.duplicate, true); assert.equal(again.source.id, first.source.id)
  assert.equal((await readdir(join(p.dataRoot, 'projects/project-1/research/sources'))).length, 1)
  assert.deepEqual(await research({ ...p, action: 'read-source', sourceId: first.source.id }), { source: first.source, text: 'Winter: 06:10.' })
  await research({ ...p, action: 'update-source', sourceId: first.source.id, patch: { status: 'read' } })
  const highlight = { id: 'h-1', sourceId: first.source.id, from: 0, to: 6, quote: 'Winter', color: 2, createdAt: now.toISOString() }
  await research({ ...p, action: 'save-annotations', highlights: [highlight], notes: [{ id: 'n-1', title: 'Why', body: 'Check the date.' }], ai: [] })
  const index = await research({ ...p, action: 'load' })
  assert.equal(index.sources[0].status, 'read'); assert.deepEqual(index.highlights, [highlight]); assert.equal(index.notes[0].body, 'Check the date.')
  await assert.rejects(research({ ...p, action: 'save-annotations', highlights: [{ ...highlight, sourceId: 'missing' }], notes: [], ai: [] }), /Invalid highlight/)
  await assert.rejects(research({ ...p, action: 'update-source', sourceId: first.source.id, patch: { status: 'deleted' } }), /status/)
})
test('research refuses unknown projects and path tricks', async () => {
  const p = await project()
  await assert.rejects(research({ ...p, projectId: '../ideas', action: 'load' }), /Choose a project/)
  await assert.rejects(research({ ...p, projectId: 'gone', action: 'load' }), /no longer in the library/)
  await assert.rejects(research({ ...p, action: 'read-source', sourceId: '../../project.json' }), /no longer saved/)
  await assert.rejects(research({ ...p, action: 'add-source', meta: { title: '' }, text: '' }), /needs a title/)
})
test('inbox files are imported once, duplicates and broken files are set aside, nothing is deleted', async () => {
  const p = await project(), inbox = join(p.dataRoot, 'projects/project-1/research/inbox')
  await mkdir(inbox, { recursive: true })
  const { writeFile } = await import('node:fs/promises')
  const file = (title, url) => `---\ntitle: ${title}\nurl: ${url}\ntype: blog\ntopic: ferries\nsummary: Short.\n---\nText of ${title}.`
  await writeFile(join(inbox, 'a.md'), file('Ferry blog', 'https://example.com/a'))
  await writeFile(join(inbox, 'b.md'), file('Same page', 'https://example.com/a?utm_source=claude'))
  await writeFile(join(inbox, 'c.md'), '---\nurl: https://example.com/c\n---\nNo title.')
  await writeFile(join(inbox, 'notes.txt'), 'not a source'); await writeFile(join(inbox, 'draft-md'), 'no extension')
  assert.equal(await research({ ...p, action: 'pending' }), 3)
  const result = await research({ ...p, action: 'scan-inbox' }, { settleMs: 0 })
  assert.deepEqual(result.imported.map(s => [s.title, s.origin, s.status]), [['Ferry blog', 'inbox', 'unread']])
  assert.deepEqual([result.duplicates, result.invalid], [['b.md'], ['c.md']])
  assert.deepEqual((await readdir(inbox)).sort(), ['_duplicates', '_imported', '_invalid', 'draft-md', 'notes.txt'])
  assert.equal(await research({ ...p, action: 'pending' }), 0)
  const index = await research({ ...p, action: 'load' })
  assert.equal(index.sources.length, 1)
  assert.equal((await research({ ...p, action: 'read-source', sourceId: index.sources[0].id })).text, 'Text of Ferry blog.')
  await writeFile(join(inbox, 'a.md'), file('Again', 'https://example.com/a'))
  assert.deepEqual((await research({ ...p, action: 'scan-inbox' }, { settleMs: 0 })).duplicates, ['a.md'])
  assert.equal((await readdir(join(inbox, '_duplicates'))).length, 2)
  await writeFile(join(inbox, 'fresh.md'), file('Still writing', 'https://example.com/f'))
  assert.deepEqual((await research({ ...p, action: 'scan-inbox' }, { settleMs: 60000 })).imported, [])
  assert.equal(await research({ ...p, action: 'pending' }), 1)
})
test('a search request is saved as a readable file with the inbox path and source format', async () => {
  const p = await project(), now = new Date('2026-10-29T10:00:00Z')
  const result = await research({ ...p, action: 'add-request', topic: 'Kış vapur tarifesi', angle: 'Sabah ilk sefer', language: 'tr', count: 3, projectTitle: 'Son Vapur' }, { now })
  const inbox = join(p.dataRoot, 'projects/project-1/research/inbox')
  assert.equal(result.inbox, inbox)
  const file = await readFile(result.path, 'utf8')
  assert.match(file, /^---\ntopic: "Kış vapur tarifesi"\nangle: "Sabah ilk sefer"\nlanguage: tr\ncount: 3\ncreated: 2026-10-29T10:00:00.000Z\n---\n/)
  for (const line of ['Topic: Kış vapur tarifesi', 'Angle: Sabah ilk sefer', 'Language of the sources: Turkish', 'How many sources: 3', inbox, 'topic: Kış vapur tarifesi', '("Son Vapur")']) assert.ok(file.includes(line), line)
  assert.equal(result.prompt, file.slice(file.indexOf('\n---\n') + 6).trimEnd())
  assert.deepEqual((await research({ ...p, action: 'load' })).requests, [{ id: result.request.id, topic: 'Kış vapur tarifesi', angle: 'Sabah ilk sefer', language: 'tr', count: 3, createdAt: '2026-10-29T10:00:00.000Z' }])
  assert.equal((await research({ ...p, action: 'add-request', topic: 'x', count: 99 })).request.count, 20)
  await assert.rejects(research({ ...p, action: 'add-request', topic: '  ' }), /Name the topic/)
})
test('quick successive quotes are all recorded and mark the source as quoted', async () => {
  const p = await project()
  const { source } = await research({ ...p, action: 'add-source', meta: { title: 'Ferry' }, text: 'Text.' })
  await Promise.all([1, 2, 3].map(n => queued({ ...p, action: 'update-source', sourceId: source.id, patch: { addUse: { sectionId: null, at: `2026-10-29T10:0${n}:00Z`, highlightId: n === 2 ? 'h-2' : 'not valid!' } } })))
  const saved = (await research({ ...p, action: 'load' })).sources[0]
  assert.equal(saved.status, 'used')
  assert.deepEqual(saved.usedIn.map(u => [u.at, u.highlightId]), [['2026-10-29T10:01:00Z', undefined], ['2026-10-29T10:02:00Z', 'h-2'], ['2026-10-29T10:03:00Z', undefined]])
  await assert.rejects(research({ ...p, action: 'update-source', sourceId: source.id, patch: { addUse: { sectionId: '../x', at: '' } } }), /quote location/)
})
