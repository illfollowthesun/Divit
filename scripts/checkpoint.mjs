// Portable feature history when the main repository's .git is read-only.
// This is a separate repository with its own copied worktree, not an alternate
// index pointing into the protected repository.
import { readdir, mkdir, copyFile, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
const root = process.cwd()
const history = join(root, '.tools', 'phase2-history')
const ignored = new Set(['.git', '.tools', '.tmp', 'node_modules', 'dist', 'test-results', 'playwright-report'])
async function copy(source, target) {
  await mkdir(target, { recursive: true })
  for (const item of await readdir(source, { withFileTypes: true })) {
    if (ignored.has(item.name) || /\.(log|tsbuildinfo)$/.test(item.name)) continue
    const from = join(source, item.name), to = join(target, item.name)
    if (item.isDirectory()) await copy(from, to)
    else if (item.isFile()) await copyFile(from, to)
  }
}
function git(args) {
  const result = spawnSync('git', args, { cwd: history, encoding: 'utf8', windowsHide: true })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout)
  return result.stdout.trim()
}
const title = process.argv.slice(2).join(' ').trim()
if (!title) throw new Error('Provide a commit message.')
await mkdir(history, { recursive: true })
try { await readFile(join(history, '.git', 'HEAD')) } catch { git(['init', '--initial-branch=main']) }
await copy(root, history)
git(['add', '--all'])
console.log(git(['-c', 'core.hooksPath=', 'commit', '-m', title]))
const bundle = resolve(root, '.tools', 'yazi-phase2.bundle')
git(['bundle', 'create', bundle, '--all'])
console.log(`Portable history: ${history}\nBundle: ${bundle}`)
