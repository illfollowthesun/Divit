import { marked } from 'marked'
import type { Token, Tokens } from 'marked'

// The manuscript as simple blocks for the built-in Word and PDF exporters, which need no Pandoc.
// Markdown footnotes ([^1] … [^1]: text) become superscript numbers and a Notes list at the end.
export type Run = { text: string; bold?: boolean; italic?: boolean; code?: boolean; strike?: boolean; sup?: boolean; link?: string }
export type Block =
  | { kind: 'heading'; level: number; runs: Run[] }
  | { kind: 'paragraph'; runs: Run[] }
  | { kind: 'quote'; blocks: Block[] }
  | { kind: 'list'; ordered: boolean; start: number; items: Run[][] }
  | { kind: 'image'; src: string; alt: string }
  | { kind: 'code'; text: string }
  | { kind: 'rule' }

function inline(tokens: Token[] | undefined, style: Omit<Run, 'text'> = {}): Run[] {
  const runs: Run[] = []
  for (const token of tokens ?? []) {
    switch (token.type) {
      case 'strong': runs.push(...inline((token as Tokens.Strong).tokens, { ...style, bold: true })); break
      case 'em': runs.push(...inline((token as Tokens.Em).tokens, { ...style, italic: true })); break
      case 'del': runs.push(...inline((token as Tokens.Del).tokens, { ...style, strike: true })); break
      case 'codespan': runs.push({ ...style, text: (token as Tokens.Codespan).text, code: true }); break
      case 'link': runs.push(...inline((token as Tokens.Link).tokens, { ...style, link: (token as Tokens.Link).href })); break
      case 'br': runs.push({ ...style, text: '\n' }); break
      case 'image': break // images are lifted out as their own blocks
      case 'text': { const t = token as Tokens.Text; if (t.tokens?.length) runs.push(...inline(t.tokens, style)); else runs.push(...footnoteRefs(t.text, style)); break }
      default: if ('text' in token && typeof token.text === 'string') runs.push(...footnoteRefs(token.text, style))
    }
  }
  return runs
}
const unescape = (text: string) => text.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
// Splits "[^2]" markers out of text as superscript runs.
function footnoteRefs(text: string, style: Omit<Run, 'text'>): Run[] {
  return unescape(text).split(/(\[\^[^\]\s]+\])/).filter(Boolean).map(part => /^\[\^[^\]\s]+\]$/.test(part) ? { ...style, text: part.slice(2, -1), sup: true } : { ...style, text: part })
}
function images(tokens: Token[] | undefined): Block[] {
  const found: Block[] = []
  for (const token of tokens ?? []) {
    if (token.type === 'image') found.push({ kind: 'image', src: (token as Tokens.Image).href, alt: (token as Tokens.Image).text })
    else if ('tokens' in token) found.push(...images((token as { tokens?: Token[] }).tokens))
  }
  return found
}
function blocks(tokens: Token[]): Block[] {
  const out: Block[] = []
  for (const token of tokens) {
    switch (token.type) {
      case 'heading': out.push({ kind: 'heading', level: (token as Tokens.Heading).depth, runs: inline((token as Tokens.Heading).tokens) }); break
      case 'paragraph': {
        const p = token as Tokens.Paragraph, runs = inline(p.tokens)
        if (runs.some(r => r.text.trim())) out.push({ kind: 'paragraph', runs })
        out.push(...images(p.tokens)); break
      }
      case 'blockquote': out.push({ kind: 'quote', blocks: blocks((token as Tokens.Blockquote).tokens) }); break
      case 'list': { const l = token as Tokens.List; out.push({ kind: 'list', ordered: l.ordered, start: typeof l.start === 'number' ? l.start : 1, items: l.items.map(item => inline(item.tokens.flatMap(t => t.type === 'paragraph' || t.type === 'text' ? ((t as Tokens.Text).tokens ?? [t]) : [t]))) }); break }
      case 'code': out.push({ kind: 'code', text: (token as Tokens.Code).text }); break
      case 'hr': out.push({ kind: 'rule' }); break
      case 'html': case 'text': if ((token as Tokens.Text).text.trim()) out.push({ kind: 'paragraph', runs: footnoteRefs((token as Tokens.Text).text, {}) }); break
    }
  }
  return out
}
export function documentBlocks(markdown: string, notesHeading = 'Notes'): Block[] {
  const notes: { id: string; text: string }[] = []
  const body = markdown.replace(/^\[\^([^\]\s]+)\]:[ \t]*(.*(?:\n(?![ \t]*\n|\[\^)[ \t]+.*)*)/gm, (_, id: string, text: string) => { notes.push({ id, text: text.replace(/\n[ \t]+/g, ' ').trim() }); return '' })
  const out = blocks(marked.lexer(body))
  if (notes.length) {
    out.push({ kind: 'rule' }, { kind: 'heading', level: 2, runs: [{ text: notesHeading }] })
    for (const note of notes) out.push({ kind: 'paragraph', runs: [{ text: note.id, sup: true }, { text: ' ' }, ...inline(marked.Lexer.lexInline(note.text))] })
  }
  return out
}
