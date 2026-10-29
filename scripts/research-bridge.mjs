import { readFile, writeFile, mkdir, rename, stat, readdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { parseSource, serializeSource, normalizeUrl, cleanMeta, emptyResearch, requestPrompt } from './research-format.mjs'

// Research lives beside the writing: projects/<id>/research/{research.json, sources/, inbox/, requests/}.
const validId = value => typeof value === 'string' && /^[A-Za-z0-9-]{1,100}$/.test(value)
const statuses = ['unread', 'read', 'used']
const MAX_TEXT = 2 * 1024 * 1024

async function atomic(path, text) {
  const temporary = `${path}.${randomUUID()}.pending`
  await writeFile(temporary, text, { encoding: 'utf8', flag: 'wx' }); await rename(temporary, path)
}
async function folders(request) {
  if (!validId(request.projectId)) throw new Error('Choose a project first.')
  const project = join(resolve(request.dataRoot), 'projects', request.projectId)
  if (request.createProject) await mkdir(project, { recursive: true })
  else if (!(await stat(project).catch(() => null))?.isDirectory()) throw new Error('This project is no longer in the library.')
  const root = join(project, 'research')
  return { root, index: join(root, 'research.json'), sources: join(root, 'sources'), inbox: join(root, 'inbox'), requests: join(root, 'requests') }
}
async function loadIndex(paths) {
  try { return { ...emptyResearch(), ...JSON.parse(await readFile(paths.index, 'utf8')) } }
  catch (error) { if (error.code === 'ENOENT') return emptyResearch(); throw new Error('research.json could not be read. Nothing was changed.') }
}
async function saveIndex(paths, index) { await mkdir(paths.root, { recursive: true }); await atomic(paths.index, JSON.stringify(index, null, 2)) }

// Adds one source unless its URL is already saved. Returns the stored record, or the existing duplicate.
async function addSource(paths, index, meta, text, origin, now) {
  const clean = cleanMeta(meta)
  if (!clean) throw new Error('A source needs a title.')
  if (typeof text !== 'string' || Buffer.byteLength(text) > MAX_TEXT) throw new Error('This source text is too large (over 2 MB).')
  const key = clean.url ? normalizeUrl(clean.url) : ''
  const duplicate = key && index.sources.find(s => s.url && normalizeUrl(s.url) === key)
  if (duplicate) return { source: duplicate, duplicate: true }
  clean.saved ??= now.toISOString().slice(0, 10)
  const source = { id: randomUUID(), ...clean, status: 'unread', origin, addedAt: now.toISOString(), usedIn: [] }
  await mkdir(paths.sources, { recursive: true })
  await atomic(join(paths.sources, `${source.id}.md`), serializeSource(clean, text))
  index.sources.push(source)
  return { source, duplicate: false }
}
function checkAnnotations(index, { highlights, notes, ai }) {
  if (![highlights, notes, ai].every(Array.isArray)) throw new Error('Invalid research notes.')
  const ids = new Set(index.sources.map(s => s.id))
  for (const h of highlights) if (!validId(h?.id) || !ids.has(h.sourceId) || !Number.isInteger(h.from) || !Number.isInteger(h.to) || h.from > h.to || typeof h.quote !== 'string' || ![1, 2, 3, 4].includes(h.color)) throw new Error('Invalid highlight.')
  for (const n of [...notes, ...ai]) if (!validId(n?.id) || typeof n.body !== 'string') throw new Error('Invalid research note.')
  if (JSON.stringify({ highlights, notes, ai }).length > 5 * 1024 * 1024) throw new Error('Research notes are too large.')
}

// Inbox files are never deleted: each moves to _imported, _duplicates or _invalid beside it.
async function moveAside(inbox, name, folder) {
  const target = join(inbox, folder); await mkdir(target, { recursive: true })
  const taken = await stat(join(target, name)).then(() => true, () => false)
  await rename(join(inbox, name), join(target, taken ? `${Date.now()}-${name}` : name))
}
const inboxFiles = async inbox => (await readdir(inbox, { withFileTypes: true }).catch(() => [])).filter(item => item.isFile() && /\.md$/i.test(item.name)).map(item => item.name).sort()
async function scanInbox(paths, index, now, settleMs) {
  const imported = [], duplicates = [], invalid = []
  for (const name of await inboxFiles(paths.inbox)) {
    const path = join(paths.inbox, name), info = await stat(path).catch(() => null)
    // A file still being written waits for the next scan.
    if (!info || settleMs > 0 && Date.now() - info.mtimeMs < settleMs) continue // mtime can be a hair ahead of Date.now() on Windows
    let result = null
    try {
      if (info.size > MAX_TEXT) throw new Error('too large')
      const parsed = parseSource(await readFile(path, 'utf8'))
      result = await addSource(paths, index, parsed.meta, parsed.text, 'inbox', now)
      if (!result.duplicate) await saveIndex(paths, index)
    } catch { result = null }
    await moveAside(paths.inbox, name, !result ? '_invalid' : result.duplicate ? '_duplicates' : '_imported')
    if (!result) invalid.push(name); else if (result.duplicate) duplicates.push(name); else imported.push(result.source)
  }
  return { imported, duplicates, invalid }
}

// The only network call besides AI requests the writer starts: fetching a page the writer pasted.
const MAX_PAGE = 5 * 1024 * 1024
function charset(contentType, head) {
  const declared = /charset=["']?([\w-]+)/i.exec(contentType)?.[1] ?? /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)?.[1]
  try { return new TextDecoder(declared ?? 'utf-8') } catch { return new TextDecoder('utf-8') }
}
export async function fetchPage(url, runtime = {}) {
  let parsed; try { parsed = new URL(String(url).trim()) } catch { throw new Error('Paste a full web address, starting with https://.') }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('Only http and https pages can be saved.')
  let response
  try { response = await fetch(parsed, { redirect: 'follow', signal: AbortSignal.timeout(runtime.timeoutMs ?? 15000), headers: { 'User-Agent': 'Divit/0.1 (private research copy)', Accept: 'text/html,application/xhtml+xml,text/plain;q=0.9' } }) }
  catch (error) { throw new Error(error.name === 'TimeoutError' ? 'The page took too long to answer. Try again later.' : 'The page could not be reached. Check the address and your connection.') }
  if (!response.ok) throw new Error(`The page answered with an error (${response.status}).`)
  const contentType = response.headers.get('content-type') ?? ''
  if (!/text\/html|application\/xhtml|text\/plain/i.test(contentType)) throw new Error(/pdf/i.test(contentType) ? 'PDFs cannot be saved this way yet. Save the text into the inbox instead.' : 'This address is not a web page.')
  const chunks = []; let size = 0
  for await (const chunk of response.body) { size += chunk.length; if (size > MAX_PAGE) throw new Error('This page is too large to save (over 5 MB).'); chunks.push(chunk) }
  const bytes = Buffer.concat(chunks)
  return { html: charset(contentType, bytes.subarray(0, 2048).toString('latin1')).decode(bytes), url: response.url || parsed.href, contentType }
}

export async function research(request, runtime = {}) {
  if (request.action === 'fetch-page') return await fetchPage(request.url, runtime)
  const paths = await folders(request), now = runtime.now ?? new Date()
  if (request.action === 'load') return await loadIndex(paths)
  if (request.action === 'pending') return (await inboxFiles(paths.inbox)).length
  const index = await loadIndex(paths)
  if (request.action === 'scan-inbox') return await scanInbox(paths, index, now, runtime.settleMs ?? 300)
  if (request.action === 'read-source') {
    const source = index.sources.find(s => s.id === request.sourceId)
    if (!source || !validId(source.id)) throw new Error('This source is no longer saved.')
    return { source, text: parseSource(await readFile(join(paths.sources, `${source.id}.md`), 'utf8')).text }
  }
  if (request.action === 'add-source') {
    const result = await addSource(paths, index, request.meta ?? {}, request.text ?? '', ['url', 'ai-found'].includes(request.origin) ? request.origin : 'url', now)
    if (!result.duplicate) await saveIndex(paths, index)
    return result
  }
  if (request.action === 'update-source') {
    const source = index.sources.find(s => s.id === request.sourceId), patch = request.patch ?? {}
    if (!source) throw new Error('This source is no longer saved.')
    if (patch.status !== undefined) { if (!statuses.includes(patch.status)) throw new Error('Invalid source status.'); source.status = patch.status }
    if (patch.scopeId !== undefined) { if (patch.scopeId !== null && !validId(patch.scopeId)) throw new Error('Invalid section.'); source.scopeId = patch.scopeId }
    if (patch.addUse !== undefined) {
      const use = patch.addUse
      if (!use || use.sectionId !== null && !validId(use.sectionId)) throw new Error('Invalid quote location.')
      source.usedIn = [...(source.usedIn ?? []), { sectionId: use.sectionId, at: String(use.at), highlightId: validId(use.highlightId) ? use.highlightId : undefined }]
      source.status = 'used'
    }
    if (patch.usedIn !== undefined) { if (!Array.isArray(patch.usedIn) || patch.usedIn.some(u => u.sectionId !== null && !validId(u.sectionId))) throw new Error('Invalid quote location.'); source.usedIn = patch.usedIn.map(u => ({ sectionId: u.sectionId, at: String(u.at), highlightId: validId(u.highlightId) ? u.highlightId : undefined })) }
    await saveIndex(paths, index)
    return source
  }
  if (request.action === 'add-request') {
    const topic = String(request.topic ?? '').trim().slice(0, 300), angle = String(request.angle ?? '').trim().slice(0, 300)
    const language = request.language === 'tr' ? 'tr' : 'en', count = Math.max(1, Math.min(20, Math.round(Number(request.count) || 5)))
    if (!topic) throw new Error('Name the topic to search for.')
    const entry = { id: randomUUID(), topic, ...(angle ? { angle } : {}), language, count, createdAt: now.toISOString() }
    const prompt = requestPrompt({ ...entry, inbox: paths.inbox, projectTitle: String(request.projectTitle ?? '').trim() })
    await mkdir(paths.requests, { recursive: true }); await mkdir(paths.inbox, { recursive: true })
    const header = ['---', `topic: ${JSON.stringify(topic)}`, ...(angle ? [`angle: ${JSON.stringify(angle)}`] : []), `language: ${language}`, `count: ${count}`, `created: ${entry.createdAt}`, '---', ''].join('\n')
    await atomic(join(paths.requests, `${entry.id}.md`), `${header}\n${prompt}\n`)
    index.requests = [...(index.requests ?? []), entry]
    await saveIndex(paths, index)
    return { request: entry, prompt, inbox: paths.inbox, path: join(paths.requests, `${entry.id}.md`) }
  }
  if (request.action === 'save-annotations') {
    checkAnnotations(index, request)
    Object.assign(index, { highlights: request.highlights, notes: request.notes, ai: request.ai })
    await saveIndex(paths, index)
    return index
  }
  throw new Error('Unknown research action.')
}
// One request at a time per process (the preview server); the desktop app also holds its storage lock.
let queue = Promise.resolve()
export function queued(request, runtime) {
  // Reads never wait behind writes: every write is an atomic rename, so a reader sees a whole file.
  // A slow page fetch must not hold up saving either.
  if (['fetch-page', 'pending', 'load', 'read-source'].includes(request.action)) return research(request, runtime)
  const next = queue.then(() => research(request, runtime)); queue = next.catch(() => {}); return next
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  let raw = ''; for await (const chunk of process.stdin) raw += chunk
  try { process.stdout.write(JSON.stringify({ ok: true, result: await research(JSON.parse(raw)) })) }
  catch (error) { process.stdout.write(JSON.stringify({ ok: false, error: error.message })); process.exitCode = 1 }
}
