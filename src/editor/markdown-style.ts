import { HighlightStyle, syntaxHighlighting } from '@codemirror/language'
import { tags } from '@lezer/highlight'

// Headings are told apart by size alone: no underline (that reads as a link) and the # marks fade into the margin.
const style = HighlightStyle.define([
  { tag: tags.heading1, fontSize: '1.55em', fontWeight: '600', textDecoration: 'none' },
  { tag: tags.heading2, fontSize: '1.35em', fontWeight: '600', textDecoration: 'none' },
  { tag: tags.heading3, fontSize: '1.18em', fontWeight: '600', textDecoration: 'none' },
  { tag: [tags.heading4, tags.heading5, tags.heading6], fontWeight: '600', textDecoration: 'none' },
  { tag: tags.processingInstruction, color: 'var(--muted)', fontWeight: 'normal' },
  { tag: tags.emphasis, fontStyle: 'italic' },
  { tag: tags.strong, fontWeight: 'bold' },
  { tag: tags.strikethrough, textDecoration: 'line-through' },
  { tag: tags.link, textDecoration: 'underline' },
  { tag: tags.url, color: 'var(--muted)' },
])

export const markdownStyle = syntaxHighlighting(style)
