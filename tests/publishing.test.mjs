import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp, mkdir, writeFile, readFile, access, copyFile, symlink } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { slugify, validateSlug, frontmatter, run, planPublish, publish, imageTools, prepareImage } from '../scripts/site-bridge.mjs'

const project = { title: 'İstanbul: bir yürüyüş', slug: 'istanbul-bir-yuruyus', date: '2026-10-29', excerpt: 'Sokakta bir gün', standfirst: 'Yağmurdan sonra.', place: 'İstanbul', tags: ['şehir', 'günlük'], body: 'Kendi sesimle bir paragraf.\n\n## Bir köşe\n\nYeni bir ayrıntı.' }
const command = 'node --experimental-strip-types --no-warnings --import ./scripts/lib/ts.mjs scripts/check-content.mjs'
async function fixture(t, fails = false) {
  // Keep fixtures: tests never delete user files, and failed cases are inspectable.
  const repo = await mkdtemp(join(process.cwd(), '.tmp', 'publish-'))
  t.diagnostic(`Fixture: ${repo}`)
  for (const dir of ['content/posts', 'public/content/posts', 'scripts/lib']) await mkdir(join(repo, dir), { recursive: true })
  await writeFile(join(repo, 'keystatic.config.ts'), '// fixture')
  await writeFile(join(repo, 'scripts/lib/ts.mjs'), '')
  await writeFile(join(repo, 'scripts/check-content.mjs'), fails ? 'console.error("broken content"); process.exit(1)' : 'console.log("content OK")')
  await writeFile(join(repo, 'package.json'), JSON.stringify({ scripts: { 'check:content': command } }))
  await run('git', ['init', '--initial-branch=main'], repo)
  await run('git', ['config', 'user.name', 'Yazi Test'], repo)
  await run('git', ['config', 'user.email', 'test@example.invalid'], repo)
  await run('git', ['add', '.'], repo)
  await run('git', ['-c', 'core.hooksPath=', 'commit', '-m', 'fixture'], repo)
  return { repo, project, images: [], dataRoot: tmpdir() }
}
await mkdir(join(process.cwd(), '.tmp'), { recursive: true })
test('Turkish slug and traversal protection', () => {
  assert.equal(slugify('İstanbul’da ışık, çığ ve öykü!'), 'istanbul-da-isik-cig-ve-oyku')
  assert.equal(slugify('  Café — bir gün  '), 'cafe-bir-gun')
  for (const value of ['../outside', 'a/b', '', '-bad', 'a'.repeat(101), 'C:\\outside', 'con', 'nul', 'com1', 'lpt9']) assert.throws(() => validateSlug(value))
})
test('frontmatter keeps Unicode and quotes newlines / YAML control characters', () => {
  const output = frontmatter({ ...project, title: 'Başlık: "evet"\n---\nbody: kötü' })
  assert.ok(output.includes('title: "Başlık: \\"evet\\"\\n---\\nbody: kötü"'))
  assert.equal(output.split('\n').filter(l => l === '---').length, 2)
  assert.ok(output.includes('  discriminant: essay'))
  assert.ok(output.includes('tags: ["şehir","günlük"]'))
  assert.throws(() => frontmatter({ ...project, body: '' }))
  assert.throws(() => frontmatter({ ...project, date: 'tomorrow' }))
})
test('plan reads the repository without changing branch or writing content', async t => {
  const request = await fixture(t); const plan = await planPublish(request)
  assert.equal(plan.branch, `post/${project.slug}`)
  assert.deepEqual(plan.files, [`content/posts/${project.slug}.md`])
  assert.equal(await run('git', ['branch', '--show-current'], request.repo), 'main')
  await assert.rejects(access(join(request.repo, plan.files[0])))
})
test('dirty repository, duplicate paths, existing branches and missing images stop before mutation', async t => {
  const request = await fixture(t)
  await writeFile(join(request.repo, 'unrelated.txt'), 'keep this')
  await assert.rejects(planPublish(request), /uncommitted/)
  await run('git', ['add', '.'], request.repo); await run('git', ['-c', 'core.hooksPath=', 'commit', '-m', 'unrelated'], request.repo)
  await assert.rejects(planPublish({ ...request, project: { ...project, body: '![lost](yazi-image:missing)' } }), /missing/)
  await writeFile(join(request.repo, `content/posts/${project.slug}.md`), 'original post')
  await run('git', ['add', '.'], request.repo); await run('git', ['-c', 'core.hooksPath=', 'commit', '-m', 'existing post'], request.repo)
  await assert.rejects(planPublish(request), /already uses/)
  assert.equal(await readFile(join(request.repo, `content/posts/${project.slug}.md`), 'utf8'), 'original post')
  await run('git', ['branch', `post/${project.slug}`], request.repo)
  await assert.rejects(planPublish(request), /already exists/)
})
test('publish validates, commits only intended files and never pushes', async t => {
  const request = await fixture(t); const result = await publish(request)
  assert.equal(result.check, 'content OK'); assert.match(result.commit, /^[a-f0-9]{40}$/)
  assert.equal(await run('git', ['branch', '--show-current'], request.repo), result.branch)
  assert.equal(await run('git', ['status', '--porcelain'], request.repo), '')
  assert.equal(await run('git', ['diff-tree', '--no-commit-id', '--name-only', '-r', 'HEAD'], request.repo), result.files[0])
  assert.equal(await run('git', ['remote'], request.repo), '')
  assert.equal(await readFile(join(request.repo, result.files[0]), 'utf8'), frontmatter(project))
  await assert.rejects(publish(request), /already exists/)
})
test('failed content check keeps files for review without committing', async t => {
  const request = await fixture(t, true); const before = await run('git', ['rev-parse', 'HEAD'], request.repo)
  await assert.rejects(publish(request), /broken content[\s\S]*Nothing was pushed/)
  assert.equal(await run('git', ['rev-parse', 'HEAD'], request.repo), before)
  assert.equal(await readFile(join(request.repo, `content/posts/${project.slug}.md`), 'utf8'), frontmatter(project))
})
test('changed check command and existing image destinations stop before creating a branch', async t => {
  const request = await fixture(t)
  await writeFile(join(request.repo, 'package.json'), JSON.stringify({ scripts: { 'check:content': 'different command' } }))
  await run('git', ['add', '.'], request.repo); await run('git', ['-c', 'core.hooksPath=', 'commit', '-m', 'changed command'], request.repo)
  await assert.rejects(planPublish(request), /check command changed/)
  assert.equal(await run('git', ['branch', '--show-current'], request.repo), 'main')
  await writeFile(join(request.repo, 'package.json'), JSON.stringify({ scripts: { 'check:content': command } }))
  const imageDir = join(request.repo, 'public/content/posts', project.slug)
  await mkdir(imageDir, { recursive: true }); await writeFile(join(imageDir, 'a.jpg'), 'keep this existing image')
  await run('git', ['add', '.'], request.repo); await run('git', ['-c', 'core.hooksPath=', 'commit', '-m', 'existing image'], request.repo)
  await assert.rejects(planPublish({ ...request, project: { ...project, body: '![one](yazi-image:a)' }, images: [{ id: 'a', file: 'original.jpg' }] }), /Image destination already exists/)
  assert.equal(await run('git', ['branch', '--show-current'], request.repo), 'main')
  assert.equal(await readFile(join(imageDir, 'a.jpg'), 'utf8'), 'keep this existing image')
})
const site = process.env.YAZI_SITE_REPO ?? 'C:/Users/edmes/Documents/modernist-portfolio'
let tools
try { tools = await imageTools(site) } catch {}
test('real site EXIF policy: resize, orient, retain camera fields, strip GPS and serials; original unchanged', { skip: !tools && 'Set YAZI_SITE_REPO to a site checkout with sharp installed.' }, async () => {
  const input = await tools.sharp({ create: { width: 3100, height: 1700, channels: 3, background: '#bba58a' } }).withExif({ IFD0: { Make: 'Test Camera', Model: 'Yazi', Artist: 'Private name' }, IFD2: { LensModel: '35mm', BodySerialNumber: 'secret-body', LensSerialNumber: 'secret-lens', DateTimeOriginal: '2026:10:29 10:00:00' }, IFD3: { GPSLatitudeRef: 'N', GPSLatitude: '41/1 0/1 0/1', GPSLongitudeRef: 'E', GPSLongitude: '29/1 0/1 0/1' } }).withMetadata({ orientation: 6 }).jpeg().toBuffer()
  const copy = Buffer.from(input); const before = tools.readExif((await tools.sharp(input).metadata()).exif)
  assert.equal(before.gps, true); assert.ok(before.extra.includes('BodySerialNumber'))
  const output = await prepareImage(input, tools); const meta = await tools.sharp(output).metadata(); const after = tools.readExif(meta.exif)
  assert.equal(Math.max(meta.width, meta.height), 2560); assert.ok(meta.height > meta.width)
  assert.equal(after.keep.IFD0.Make, 'Test Camera'); assert.equal(after.keep.IFD2.LensModel, '35mm')
  assert.deepEqual(tools.exifProblems(after), []); assert.deepEqual(input, copy)
})
test('the actual Keystatic posts schema reads exported frontmatter without losing Turkish text', { skip: !tools && 'Set YAZI_SITE_REPO to an installed site checkout.' }, async t => {
  const root = await mkdtemp(join(process.cwd(), '.tmp', 'schema-'))
  t.diagnostic(`Schema fixture: ${root}`)
  await mkdir(join(root, 'content/posts'), { recursive: true })
  await writeFile(join(root, `content/posts/${project.slug}.md`), frontmatter(project), 'utf8')
  const require = createRequire(pathToFileURL(join(site, 'package.json')))
  const readerModule = pathToFileURL(require.resolve('@keystatic/core/reader')).href
  const configModule = pathToFileURL(join(site, 'keystatic.config.ts')).href
  const code = `import {createReader} from ${JSON.stringify(readerModule)}; import config from ${JSON.stringify(configModule)}; const reader=createReader(${JSON.stringify(root)},config); console.log(JSON.stringify(await reader.collections.posts.read(${JSON.stringify(project.slug)})));`
  const output = await run(process.execPath, ['--experimental-strip-types', '--no-warnings', '--import', pathToFileURL(join(site, 'scripts/lib/ts.mjs')).href, '--input-type=module', '-e', code], root)
  const parsed = JSON.parse(output)
  assert.equal(parsed.title, project.title); assert.equal(parsed.place, project.place)
  assert.equal(parsed.date, project.date); assert.deepEqual(parsed.tags, project.tags)
  assert.equal(parsed.standfirst, project.standfirst); assert.equal(parsed.kind.discriminant, 'essay')
})
test('image transfer keeps originals and resolves each full image ID exactly once', { skip: !tools && 'Set YAZI_SITE_REPO to an installed site checkout.' }, async t => {
  const request = await fixture(t)
  // The fixture uses the real installed tools, with the site's EXIF file copied unchanged.
  await writeFile(join(request.repo, '.gitignore'), 'node_modules/\n')
  await symlink(join(site, 'node_modules'), join(request.repo, 'node_modules'), process.platform === 'win32' ? 'junction' : 'dir')
  await copyFile(join(site, 'scripts/lib/exif.mjs'), join(request.repo, 'scripts/lib/exif.mjs'))
  await run('git', ['add', '.'], request.repo); await run('git', ['-c', 'core.hooksPath=', 'commit', '-m', 'image tools'], request.repo)
  const dataRoot = await mkdtemp(join(process.cwd(), '.tmp', 'image-data-'))
  const input = await tools.sharp({ create: { width: 3000, height: 1600, channels: 3, background: '#8c4228' } }).withExif({ IFD0: { Make: 'Test' }, IFD2: { BodySerialNumber: 'secret' } }).jpeg().toBuffer()
  const images = [{ id: 'a', file: 'original.jpg' }, { id: 'ab', file: 'original.jpg' }]
  for (const image of images) {
    await mkdir(join(dataRoot, 'images', image.id), { recursive: true })
    await writeFile(join(dataRoot, 'images', image.id, image.file), input)
  }
  const body = '![First](yazi-image:a)\n\n![Second](yazi-image:ab)'
  const result = await publish({ ...request, dataRoot, images, project: { ...project, body } })
  const output = await readFile(join(request.repo, result.files[0]), 'utf8')
  assert.ok(output.includes(`![First](/content/posts/${project.slug}/a.jpg)`))
  assert.ok(output.includes(`![Second](/content/posts/${project.slug}/ab.jpg)`))
  assert.equal(result.files.length, 3)
  for (const image of images) {
    assert.deepEqual(await readFile(join(dataRoot, 'images', image.id, image.file)), input)
    const meta = await tools.sharp(await readFile(join(request.repo, `public/content/posts/${project.slug}/${image.id}.jpg`))).metadata()
    assert.equal(Math.max(meta.width, meta.height), 2560)
    assert.deepEqual(tools.exifProblems(tools.readExif(meta.exif)), [])
  }
})
