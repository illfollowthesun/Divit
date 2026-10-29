// Writes latest.json for the in-app updater after a signed `tauri build`.
// Usage: node scripts/updater-manifest.mjs [owner/repo]   (default Firextream/Divit)
// Upload latest.json next to the installer and its .sig on the GitHub release v<version>.
import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const repo = process.argv[2] ?? 'Firextream/Divit'
const { version } = JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8'))
const folder = 'src-tauri/target/release/bundle/nsis'
const installer = readdirSync(folder).find(name => name.endsWith('-setup.exe') && name.includes(`_${version}_`))
if (!installer) throw new Error(`No NSIS installer for ${version} in ${folder}. Run the signed build first.`)
const signature = join(folder, `${installer}.sig`)
if (!existsSync(signature)) throw new Error(`${signature} is missing. Set TAURI_SIGNING_PRIVATE_KEY (and its password) before building.`)
const notesFile = `docs/releases/v${version}.md`
const manifest = {
  version,
  notes: existsSync(notesFile) ? readFileSync(notesFile, 'utf8').trim() : '',
  pub_date: new Date().toISOString(),
  platforms: { 'windows-x86_64': { signature: readFileSync(signature, 'utf8').trim(), url: `https://github.com/${repo}/releases/download/v${version}/${encodeURIComponent(installer)}` } },
}
writeFileSync(join(folder, 'latest.json'), JSON.stringify(manifest, null, 2) + '\n')
console.log(`Wrote ${join(folder, 'latest.json')} for ${installer}`)
