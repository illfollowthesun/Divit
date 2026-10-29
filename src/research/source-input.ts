// The Sources box takes a web address or a topic. Only text that is clearly an address is fetched;
// anything else ("winter ferries", "Node.js") becomes a search topic instead.
const commonEndings = new Set(['com', 'org', 'net', 'edu', 'gov', 'int', 'info', 'io', 'co', 'me', 'app', 'dev', 'news', 'blog', 'tr', 'uk', 'de', 'fr', 'nl', 'it', 'es', 'eu', 'us', 'ca', 'au'])
export function asUrl(text: string): string | null {
  const value = text.trim()
  if (!value || /\s/.test(value)) return null
  let candidate = value
  if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(value)) {
    const host = /^([\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+)(?::\d+)?(?:[/?#]|$)/u.exec(value)?.[1]
    if (!host) return null
    const ending = host.split('.').pop()!.toLowerCase(), rest = value.slice(host.length)
    if (!host.toLowerCase().startsWith('www.') && !/^(?::\d+)?[/?#]./.test(rest) && !commonEndings.has(ending)) return null
    candidate = `https://${value}`
  }
  try { const url = new URL(candidate); return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null } catch { return null }
}
