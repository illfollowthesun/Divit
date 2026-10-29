import type { ResearchSource } from '../shared/types'

export const LONG_QUOTE_WORDS = 50
export const wordCount = (text: string) => text.trim() ? text.trim().split(/\s+/u).length : 0

// "Title, Site (2026-10-20), https://…" — every inserted quote carries this.
export function citation(source: Pick<ResearchSource, 'title' | 'site' | 'published' | 'saved' | 'url'>) {
  const date = source.published ?? source.saved
  return `${[source.title, source.site].filter(Boolean).join(', ')}${date ? ` (${date})` : ''}${source.url ? `, ${source.url}` : ''}`
}
export function quoteBlock(quote: string, source: ResearchSource) {
  return `${quote.trim().split('\n').map(line => `> ${line}`.trimEnd()).join('\n')}\n>\n> — ${citation(source)}`
}
// Markdown footnotes ([^n]) as Pandoc exports them; numbering continues after the text's last one.
export function nextFootnote(text: string) {
  return Math.max(0, ...[...text.matchAll(/^\[\^(\d+)\]:/gm)].map(match => Number(match[1]))) + 1
}
export function footnote(quote: string, source: ResearchSource, number: number) {
  return { inline: `“${quote.trim().replace(/\s*\n\s*/g, ' ')}”[^${number}]`, note: `[^${number}]: ${citation(source)}` }
}
