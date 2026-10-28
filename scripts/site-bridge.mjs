// Local-only bridge. Uses the site's existing sharp installation and EXIF policy verbatim.
import { readFile, writeFile, mkdir, access } from 'node:fs/promises'
import { resolve, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'

export function slugify(value) {
  const chars = {ı:'i',İ:'i',ş:'s',Ş:'s',ğ:'g',Ğ:'g',ü:'u',Ü:'u',ö:'o',Ö:'o',ç:'c',Ç:'c'}
  return value.replace(/[ıİşŞğĞüÜöÖçÇ]/g, c => chars[c]).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100).replace(/-+$/g, '')
}
export function validateSlug(slug) {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length > 100) throw new Error('Use a short address with letters, numbers and hyphens.')
  if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(slug)) throw new Error('This address is reserved by Windows. Add another word.')
}
const quote = value => JSON.stringify(String(value ?? ''))
export function frontmatter(project, body = project.body) {
  if (!project.title.trim() || !body.trim()) throw new Error('A title and text are required.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(project.date) || Number.isNaN(Date.parse(project.date)) || new Date(project.date).toISOString().slice(0, 10) !== project.date) throw new Error('Choose a valid date.')
  if (!Array.isArray(project.tags) || project.tags.some(tag => typeof tag !== 'string')) throw new Error('Tags must be text.')
  return ['---', `title: ${quote(project.title)}`, 'kind:', '  discriminant: essay', `date: ${quote(project.date)}`, `excerpt: ${quote(project.excerpt)}`, `place: ${quote(project.place)}`, `tags: ${JSON.stringify(project.tags)}`, `standfirst: ${quote(project.standfirst)}`, '---', body, ''].join('\n')
}
export function run(command, args, cwd, timeout = 120000) {
  return new Promise((accept, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true, shell: false, env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } })
    let output = ''
    const timer = setTimeout(() => { child.kill(); reject(new Error(`${command} timed out. Inspect the site working tree before retrying.`)) }, timeout)
    child.stdout.on('data', data => { output = (output + data).slice(-32000) })
    child.stderr.on('data', data => { output = (output + data).slice(-32000) })
    child.on('error', error => { clearTimeout(timer); reject(error) })
    child.on('close', code => { clearTimeout(timer); code === 0 ? accept(output.trim()) : reject(new Error(output.trim() || `${command} exited ${code}`)) })
  })
}
export async function imageTools(repo) {
  const { default: sharp } = await import(pathToFileURL(join(repo, 'node_modules/sharp/lib/index.js')).href)
  const { readExif, exifProblems } = await import(pathToFileURL(join(repo, 'scripts/lib/exif.mjs')).href)
  return { sharp, readExif, exifProblems }
}
export async function prepareImage(input, tools) {
  const { sharp, readExif, exifProblems } = tools
  const meta = await sharp(input).metadata()
  const exif = readExif(meta.exif)
  let img = sharp(input).rotate().resize({ width: 2560, height: 2560, fit: 'inside', withoutEnlargement: true }).keepIccProfile()
  if (Object.keys(exif.keep.IFD0).length + Object.keys(exif.keep.IFD2).length) img = img.withExif({ IFD0: { ...exif.keep.IFD0, Orientation: '1' }, IFD2: exif.keep.IFD2 })
  const output = await img.jpeg({ quality: 82, mozjpeg: true }).toBuffer()
  const after = await sharp(output).metadata()
  if (Math.max(after.width, after.height) > 2560 || exifProblems(readExif(after.exif)).length) throw new Error('Image privacy verification failed.')
  return output
}
export async function planPublish({ repo, project, images }) {
  validateSlug(project.slug)
  frontmatter(project)
  const root = resolve(repo)
  await access(join(root, 'keystatic.config.ts'))
  await access(join(root, 'scripts/check-content.mjs'))
  const pkg = JSON.parse(await readFile(join(root, 'package.json'), 'utf8'))
  if (pkg.scripts?.['check:content'] !== 'node --experimental-strip-types --no-warnings --import ./scripts/lib/ts.mjs scripts/check-content.mjs') throw new Error('The site check command changed. Update the bridge before publishing.')
  const gitRoot = await run('git', ['rev-parse', '--show-toplevel'], root)
  const comparable = path => process.platform === 'win32' ? resolve(path).toLowerCase() : resolve(path)
  if (comparable(gitRoot) !== comparable(root)) throw new Error('Choose the root of the site Git repository.')
  const status = await run('git', ['status', '--porcelain'], root)
  if (status) throw new Error('The site has uncommitted changes. Commit or set them aside before sending.')
  const refs = await run('git', ['branch', '--list', `post/${project.slug}`], root)
  if (refs) throw new Error(`Branch post/${project.slug} already exists. Choose a new address or review it in Git.`)
  const target = `content/posts/${project.slug}.md`
  try { await access(join(root, target)); throw new Error(`A post already uses ${project.slug}. Choose another address.`) } catch (e) { if (e.code !== 'ENOENT') throw e }
  const used = [...new Set([...project.body.matchAll(/yazi-image:([a-zA-Z0-9-]+)/g)].map(m => m[1]))]
  for (const id of used) if (!images.find(i => i.id === id)) throw new Error(`Image ${id} is missing.`)
  const files = [target, ...used.map(id => `public/content/posts/${project.slug}/${id}.jpg`)]
  for (const file of files.slice(1)) {
    try { await access(join(root, file)); throw new Error(`Image destination already exists: ${file}`) } catch (e) { if (e.code !== 'ENOENT') throw e }
  }
  return { branch: `post/${project.slug}`, files, used }
}
export async function publish(request) {
  const plan = await planPublish(request) // Always repeat checks immediately before mutation.
  const { repo, project, images, dataRoot } = request
  const tools = plan.used.length ? await imageTools(repo) : null
  const buffers = []
  for (const id of plan.used) {
    const image = images.find(i => i.id === id)
    if (!/^[a-zA-Z0-9-]+$/.test(id) || !/^original\.(jpg|jpeg|png|webp|avif)$/i.test(image.file)) throw new Error('Invalid image record.')
    buffers.push(await prepareImage(await readFile(join(dataRoot, 'images', id, image.file)), tools))
  }
  const body = project.body.replace(/yazi-image:([a-zA-Z0-9-]+)/g, (_, id) => `/content/posts/${project.slug}/${id}.jpg`)
  const markdown = frontmatter(project, body)
  await planPublish(request) // Image preparation may take time; check the tree again before switching.
  await run('git', ['switch', '-c', plan.branch], repo)
  try {
    for (let i = 0; i < plan.used.length; i++) {
      const destination = join(repo, plan.files[i + 1])
      await mkdir(resolve(destination, '..'), { recursive: true })
      await writeFile(destination, buffers[i], { flag: 'wx' })
    }
    await writeFile(join(repo, plan.files[0]), markdown, { flag: 'wx' })
    // Same command as npm run check:content, without a shell or npm.cmd quoting.
    const check = await run(process.execPath, ['--experimental-strip-types', '--no-warnings', '--import', './scripts/lib/ts.mjs', 'scripts/check-content.mjs'], repo)
    await run('git', ['add', '--', ...plan.files], repo)
    await run('git', ['-c', 'core.hooksPath=', 'commit', '-m', `post: ${project.title}`, '--', ...plan.files], repo)
    const commit = await run('git', ['rev-parse', 'HEAD'], repo)
    return { ...plan, commit, check, digest: createHash('sha256').update(markdown).digest('hex') }
  } catch (error) {
    throw new Error(`${error.message}\nFiles are kept on ${plan.branch} for review. Nothing was pushed; the idea remains a draft.`)
  }
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  let raw = ''
  for await (const chunk of process.stdin) raw += chunk
  try {
    const { action, ...request } = JSON.parse(raw)
    const result = action === 'plan' ? await planPublish(request) : action === 'publish' ? await publish(request) : (() => { throw new Error('Unknown action') })()
    process.stdout.write(JSON.stringify({ ok: true, result }))
  } catch (error) { process.stdout.write(JSON.stringify({ ok: false, error: error.message })); process.exitCode = 1 }
}
