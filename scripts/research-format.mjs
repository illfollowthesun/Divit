// Research source files: YAML-style frontmatter + the saved readable text, readable without Yazı.
// Pure functions, shared by the bridge, the frontend and the tests.
export const sourceFields = ['title', 'url', 'site', 'author', 'published', 'saved', 'type', 'topic', 'summary']
export const sourceTypes = ['news', 'article', 'blog', 'paper', 'other']

function unquote(value) {
  if (value.startsWith('"')) { try { return JSON.parse(value) } catch { return value } }
  if (value.startsWith("'") && value.endsWith("'") && value.length > 1) return value.slice(1, -1).replaceAll("''", "'")
  return value
}
// A plain scalar unless it could be misread; JSON strings are valid YAML double-quoted scalars.
const quote = value => /^[\s'"`>|&*!%@#?,[\]{}-]|[:#]\s|:$|\s$|[\n\r\t"\\]/.test(value) || value === '' ? JSON.stringify(value) : value

export function parseSource(file) {
  const text = file.replace(/^\uFEFF/, '').replaceAll('\r\n', '\n')
  const match = /^---\n([\s\S]*?)\n---(?:\n|$)/.exec(text)
  if (!match) return { meta: {}, text: text.trim() }
  const meta = {}
  for (const line of match[1].split('\n')) {
    const field = /^([A-Za-z][\w-]*):\s?(.*)$/.exec(line)
    if (field) meta[field[1]] = unquote(field[2].trim())
  }
  return { meta, text: text.slice(match[0].length).replace(/^\n+/, '').replace(/\s+$/, '') }
}
export function serializeSource(meta, text) {
  const lines = sourceFields.filter(key => typeof meta[key] === 'string' && meta[key] !== '').map(key => `${key}: ${quote(meta[key].replace(/\s*\n\s*/g, ' ').trim())}`)
  return `---\n${lines.join('\n')}\n---\n\n${text.replace(/\s+$/, '')}\n`
}
// The same page reached through tracking links, a #fragment or a trailing slash is one source.
export function normalizeUrl(url) {
  try {
    const parsed = new URL(url.trim())
    if (!['http:', 'https:'].includes(parsed.protocol)) return ''
    parsed.hash = ''; parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, '')
    for (const key of [...parsed.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$|mc_|ref$)/i.test(key)) parsed.searchParams.delete(key)
    parsed.searchParams.sort()
    return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, '') || '/'}${parsed.search}`
  } catch { return '' }
}
// Keep only known string fields; an unknown type becomes "other". Returns null without a title.
export function cleanMeta(meta) {
  const clean = {}
  for (const key of sourceFields) if (typeof meta[key] === 'string' && meta[key].trim()) clean[key] = meta[key].trim().slice(0, key === 'summary' ? 2000 : 500)
  if (!clean.title) return null
  if (clean.url && !normalizeUrl(clean.url)) delete clean.url
  clean.type = sourceTypes.includes(clean.type) ? clean.type : 'other'
  return clean
}
export const emptyResearch = () => ({ schemaVersion: 1, sources: [], highlights: [], notes: [], ai: [] })
