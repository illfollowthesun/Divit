// Assemble an already-built release executable with its current Tauri resources.
// No installer, signing, upload, version bump or development server is involved.
import { copyFile, mkdir, readFile, writeFile } from 'node:fs/promises'
import { resolve, dirname, relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const destination = resolve(root, '.tools/Divit-local')
const config = JSON.parse(await readFile(resolve(root, 'src-tauri/tauri.conf.json'), 'utf8'))
const sourceCommit = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim()
const resourceSources = Object.keys(config.bundle.resources).map(source => relative(root, resolve(root, 'src-tauri', source)))
const runtimeChanges = execFileSync('git', ['status', '--porcelain', '--', 'src', 'src-tauri', 'public', 'index.html', 'vite.config.ts', 'package.json', 'package-lock.json', ...resourceSources], { cwd: root, encoding: 'utf8' }).trim()
if (runtimeChanges) throw new Error('Commit runtime changes and rebuild before assembling the local application.')
await mkdir(destination, { recursive: true })
const files = [{ source: resolve(root, 'src-tauri/target/release/divit.exe'), name: 'Divit.exe' },
  ...Object.entries(config.bundle.resources).map(([source, name]) => ({ source: resolve(root, 'src-tauri', source), name })),
]
const manifest = { version: config.version, sourceCommit, assembledAt: new Date().toISOString(), mode: 'release; embedded frontend; no Vite server', files: [] }
for (const file of files) {
  const output = resolve(destination, file.name), local = relative(destination, output)
  if (isAbsolute(local) || local.startsWith('..')) throw new Error('Resource destination escapes the local application folder.')
  await mkdir(dirname(output), { recursive: true })
  await copyFile(file.source, output)
  const original = await readFile(file.source), copied = await readFile(output)
  const digest = bytes => createHash('sha256').update(bytes).digest('hex')
  if (digest(original) !== digest(copied)) throw new Error('Local application copy verification failed.')
  manifest.files.push({ name: file.name, bytes: copied.length, sha256: digest(copied) })
}
await writeFile(resolve(destination, 'LOCAL_BUILD.json'), JSON.stringify(manifest, null, 2))
console.log(`Local release ready: ${resolve(destination, 'Divit.exe')}`)
console.log(`Source: ${sourceCommit}; ${files.length} files verified. Node.js remains required for Research/backup/site bridge actions.`)
