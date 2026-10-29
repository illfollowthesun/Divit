// Lists every interface string passed to t('…') or tn(n, '…', '…') in src/, plus the data values that are
// translated at display time (DYNAMIC). Used by tests/i18n.test.mjs; run directly to see missing Turkish keys.
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

// Values shown through t(variable): tab names, stages, source types, statuses, kinds, providers and labels.
export const DYNAMIC = [
  'Preview', 'Cards', 'Notes', 'Check', 'Images', 'Sources', 'Highlights', 'Write', 'Review', 'Normal',
  'Idea', 'Research', 'Draft', 'Published', 'news', 'article', 'blog', 'paper', 'other', 'draft', 'to-fix', 'done',
  'projects', 'ideas', 'images', 'STORY', 'BOOK', 'CHAPTER', 'SCENE', 'Sand', 'Sage', 'Sky', 'Rose',
  'All changes saved', 'Saving…', 'Unsaved changes', 'Not saved — your text is still here',
  'Write / Review / Normal', 'Leave Write mode', 'New writing', 'New story or book', 'Add chapter / scene', 'Character/place cards', 'Project notebook', 'Snapshots',
  'Export', 'Save now', 'Catch an idea', 'Publish to my site (when set up)', 'Typewriter mode', 'Focus mode', 'Settings', 'Keyboard help', 'Leave focus / close dialog', 'Undo / redo',
  'Gemini 3.8 Flash', 'Gemini 3.5 Flash-Lite (lowest cost)', 'Claude Sonnet 5.5', 'Claude Haiku 5.5 (lowest cost)', 'Claude Opus 5.5',
]
const unquote = (s) => s.slice(1, -1).replace(/\\'/g, "'").replace(/\\\\/g, '\\')
export function keys(root = 'src') {
  const found = new Set(DYNAMIC)
  const walk = (dir) => { for (const name of readdirSync(dir)) { const path = join(dir, name); if (statSync(path).isDirectory()) walk(path); else if (/\.(ts|tsx)$/.test(name) && !path.includes('i18n')) scan(readFileSync(path, 'utf8')) } }
  const str = `'(?:\\\\.|[^'\\\\])*'`
  const scan = (text) => {
    for (const m of text.matchAll(new RegExp(`\\bt\\((${str})`, 'g'))) found.add(unquote(m[1]))
    for (const m of text.matchAll(new RegExp(`\\btn\\([^,]+,\\s*(${str}),\\s*(${str})`, 'g'))) { found.add(unquote(m[1])); found.add(unquote(m[2])) }
    // Module-level option lists rendered through t(): their label and note fields.
    for (const m of text.matchAll(new RegExp(`\\b(?:label|note): (${str})`, 'g'))) found.add(unquote(m[1]))
  }
  walk(root)
  return [...found].sort()
}
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { tr } = await import('../src/i18n/tr.ts').catch(() => ({ tr: {} }))
  const missing = keys().filter(k => !(k in tr))
  console.log(process.argv.includes('--all') ? keys().join('\n') : missing.length ? `Missing Turkish (${missing.length}):\n${missing.map(k => JSON.stringify(k)).join('\n')}` : 'All interface strings have a Turkish translation.')
}
