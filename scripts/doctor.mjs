import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, delimiter } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const desktop = process.argv.includes('--desktop')
const checks = []
function check(name, ok, detail, required = true) { checks.push({ name, ok, detail, required }) }
function command(name, args) {
  const result = spawnSync(name, args, { encoding: 'utf8', windowsHide: true, timeout: 10000, shell: false })
  return { ok: result.status === 0, output: (result.stdout || result.stderr || result.error?.message || '').trim() }
}

const nodeMajor = Number(process.versions.node.split('.')[0])
const nodeMinor = Number(process.versions.node.split('.')[1])
check('Node.js', nodeMajor > 22 || nodeMajor === 22 && nodeMinor >= 17, `${process.version}; Node 22.17+ required, Node 22 recommended for the site.`)
const npmName = process.platform === 'win32' ? 'npm.cmd' : 'npm'
check('npm', (process.env.PATH ?? '').split(delimiter).some(dir => existsSync(join(dir, npmName))), 'npm must be available on PATH.')
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const missing = Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }).filter(name => !existsSync(join(root, 'node_modules', name, 'package.json')))
check('App packages', missing.length === 0, missing.length ? `${missing.length} missing. Run npm.cmd install. First missing: ${missing.slice(0, 5).join(', ')}.` : 'All declared package directories are present.')

if (desktop) {
  const cargo = command('cargo', ['--version'])
  const rust = command('rustc', ['--version'])
  check('Cargo', cargo.ok, cargo.output || 'Install Rust stable with the MSVC toolchain; reopen the terminal after installation.')
  check('Rust compiler', rust.ok, rust.output || 'rustc not found.')
  if (process.platform === 'win32') {
    const vswhere = join(process.env['ProgramFiles(x86)'] ?? 'C:/Program Files (x86)', 'Microsoft Visual Studio', 'Installer', 'vswhere.exe')
    const msvc = command(vswhere, ['-latest', '-products', '*', '-requires', 'Microsoft.VisualStudio.Component.VC.Tools.x86.x64', '-property', 'installationPath'])
    check('Microsoft C++ Build Tools', msvc.ok && !!msvc.output, msvc.output || 'Install Desktop development with C++ and a Windows SDK.')
  }
  const git = command('git', ['--version'])
  check('Git for site transfer', git.ok, git.output || 'Install Git before sending posts.', false)
}

if (process.argv.includes('--json')) console.log(JSON.stringify({ mode: desktop ? 'desktop' : 'frontend', checks }, null, 2))
else {
  console.log(`Yazi ${desktop ? 'desktop' : 'browser preview'} prerequisites\n`)
  for (const item of checks) console.log(`${item.ok ? 'OK' : item.required ? 'MISSING' : 'OPTIONAL'}  ${item.name}\n    ${item.detail}`)
  console.log('\nNo installation or system setting was changed.')
}
if (checks.some(item => item.required && !item.ok)) process.exitCode = 1
