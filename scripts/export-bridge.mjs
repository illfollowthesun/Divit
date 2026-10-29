import { spawn } from 'node:child_process'
import { readFile, writeFile, mkdir, mkdtemp, copyFile, constants } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { randomUUID } from 'node:crypto'
import { slugify } from './site-bridge.mjs'
import { citation, quotedSources } from './research-format.mjs'

const formats = { markdown: 'md', pdf: 'pdf', docx: 'docx', epub: 'epub' }
const engines = { typst: 'typst', xelatex: 'latex', lualatex: 'latex', tectonic: 'latex', weasyprint: 'html5' }
function execute(executable, args, input = '', cwd, timeout = 120000) {
  return new Promise((yes, no) => {
    const child = spawn(executable, args, { cwd, windowsHide: true, shell: false, stdio: ['pipe', 'pipe', 'pipe'] })
    let stdout = '', stderr = ''
    const timer = setTimeout(() => { child.kill(); no(new Error('The export timed out. Your writing is unchanged.')) }, timeout)
    child.stdout.on('data', chunk => { stdout = (stdout + chunk).slice(-16000) }); child.stderr.on('data', chunk => { stderr = (stderr + chunk).slice(-16000) })
    child.on('error', error => { clearTimeout(timer); no(error) })
    child.on('close', code => { clearTimeout(timer); code === 0 ? yes(stdout.trim()) : no(new Error(stderr || stdout || `Converter exited ${code}`)) })
    child.stdin.on('error', () => {}); child.stdin.end(input, 'utf8')
  })
}
export async function exportTools() {
  let version = ''
  try { version = (await execute('pandoc', ['--version'], '', undefined, 5000)).split('\n')[0] } catch {}
  let pdfEngine = null
  if (version) for (const name of Object.keys(engines)) {
    if (name === 'typst' && Number(/pandoc (\d+)/.exec(version)?.[1] ?? 0) < 3) continue
    try { await execute(name, ['--version'], '', undefined, 5000); pdfEngine = name; break } catch {}
  }
  return { pandoc: !!version, version, pdfEngine }
}
// The optional Sources list: the research sources quoted in this project, first use first.
async function quotedFor(request) {
  if (!request.includeSources) return []
  if (!request.dataRoot || !/^[A-Za-z0-9-]{1,100}$/.test(request.project?.id ?? '')) throw new Error('The sources list needs the project folder.')
  try { return quotedSources(JSON.parse(await readFile(join(request.dataRoot, 'projects', request.project.id, 'research', 'research.json'), 'utf8'))) }
  catch (error) { if (error.code === 'ENOENT') return []; throw new Error('research.json could not be read, so no sources list was added. Your writing is unchanged.') }
}
export function compileMarkdown(project, imageSources = {}, sources = []) {
  const all = project.sections ?? []
  const nodes = all.filter(n => !n.trashedAt && !n.parentId).flatMap(n => [n, ...all.filter(c => !c.trashedAt && c.parentId === n.id)])
  const body = [project.body?.trim(), ...nodes.map(n => `${n.kind === 'chapter' || project.type === 'story' ? '#' : '##'} ${n.title.replace(/[\r\n]/g, ' ')}\n\n${n.body.trim()}`)].filter(Boolean).join('\n\n')
  if (!body) throw new Error('Write a little before exporting.')
  const text = body.replace(/yazi-image:([a-zA-Z0-9-]+)/g, (_, id) => { if (!imageSources[id]) throw new Error(`Image ${id} is missing from the library.`); return imageSources[id] })
  if (/!\[[^\]]*\]\(\s*<?(?:https?:|file:)/i.test(text)) throw new Error('Import external images into the image library before exporting.')
  const list = sources.length ? `\n\n# Sources\n\n${sources.map(source => `- ${citation(source).replace(/[\r\n]+/g, ' ')}`).join('\n')}` : ''
  return `---\ntitle: ${JSON.stringify(project.title || 'Untitled')}\n---\n\n${text}${list}\n`
}
async function sourcesFor(request) {
  const sources = {}, text = [request.project.body ?? '', ...(request.project.sections ?? []).filter(n => !n.trashedAt).map(n => n.body)].join('\n')
  const ids = [...new Set([...text.matchAll(/yazi-image:([a-zA-Z0-9-]+)/g)].map(m => m[1]))]
  for (const id of ids) {
    const image = (request.images ?? []).find(i => i.id === id)
    if (!image) throw new Error(`Image ${id} is missing.`)
    if (image.dataUrl && /^data:image\/(?:jpeg|png|webp|avif);base64,[a-zA-Z0-9+/=]+$/.test(image.dataUrl)) sources[id] = image.dataUrl
    else {
      if (!request.dataRoot || !/^original\.(jpg|jpeg|png|webp|avif)$/.test(image.file)) throw new Error('Invalid local image record.')
      const bytes = await readFile(join(request.dataRoot, 'images', id, image.file))
      const ext = image.file.split('.').pop(); sources[id] = `data:image/${ext === 'jpg' ? 'jpeg' : ext};base64,${bytes.toString('base64')}`
    }
  }
  return sources
}
export async function exportDocument(request, runtime = {}) {
  if (!Object.hasOwn(formats, request.format)) throw new Error('Choose Markdown, PDF, DOCX or EPUB.')
  const tools = runtime.tools ?? await exportTools()
  if (request.format !== 'markdown' && !tools.pandoc) throw new Error('Pandoc is not installed. Install Pandoc and reopen Divit, or download Markdown now.')
  if (request.format === 'pdf' && !tools.pdfEngine) throw new Error('PDF needs a Pandoc PDF engine. Install Typst (recommended) or XeLaTeX, then reopen Yazı.')
  const markdown = compileMarkdown(request.project, await sourcesFor(request), await quotedFor(request))
  const root = resolve(request.outputRoot)
  await mkdir(root, { recursive: true })
  let name = slugify(request.project.title) || 'manuscript'
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(name)) name = `writing-${name}`
  const filename = `${name}-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}.${formats[request.format]}`
  const destination = join(root, filename)
  if (request.format === 'markdown' && !tools.pandoc) {
    await writeFile(destination, markdown, { encoding: 'utf8', flag: 'wx' })
    return { path: destination, filename, format: request.format, engine: 'plain-markdown' }
  }
  const work = await mkdtemp(join(root, '.pending-')), output = join(work, `manuscript.${formats[request.format]}`)
  const args = [...(runtime.prefix ?? []), '--from=markdown-raw_html-raw_tex+yaml_metadata_block', '--standalone', '--output', output]
  if (request.format === 'pdf') {
    if (!Object.hasOwn(engines, tools.pdfEngine)) throw new Error('Unsupported PDF engine.')
    args.push(`--to=${engines[tools.pdfEngine]}`, `--pdf-engine=${tools.pdfEngine}`)
  } else args.push(`--to=${request.format === 'epub' ? 'epub3' : request.format}`)
  await execute(runtime.executable ?? 'pandoc', args, markdown, work)
  await copyFile(output, destination, constants.COPYFILE_EXCL)
  return { path: destination, filename, format: request.format, engine: tools.version }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  let raw = ''; for await (const chunk of process.stdin) raw += chunk
  try { const request = JSON.parse(raw); const result = request.action === 'status' ? await exportTools() : await exportDocument(request); process.stdout.write(JSON.stringify({ ok: true, result })) }
  catch (error) { process.stdout.write(JSON.stringify({ ok: false, error: error.message })); process.exitCode = 1 }
}
