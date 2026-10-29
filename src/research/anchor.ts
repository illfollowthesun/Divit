import type { Highlight } from '../shared/types'

export type Anchored = Highlight & { lost?: boolean }
export type Segment = { from: number; to: number; highlight?: Anchored }

// A highlight keeps its offsets while the saved text is unchanged. If the file was edited, it moves
// to the occurrence of its quote nearest to where it was; if the quote is gone it is marked lost,
// never dropped.
export function anchor(text: string, highlight: Highlight): Anchored {
  if (text.slice(highlight.from, highlight.to) === highlight.quote) return highlight
  let best = -1
  for (let at = text.indexOf(highlight.quote); at !== -1 && highlight.quote; at = text.indexOf(highlight.quote, at + 1))
    if (best === -1 || Math.abs(at - highlight.from) < Math.abs(best - highlight.from)) best = at
  return best === -1 ? { ...highlight, lost: true } : { ...highlight, from: best, to: best + highlight.quote.length }
}

export const overlaps = (from: number, to: number, highlights: Anchored[]) => highlights.some(h => !h.lost && h.from < to && from < h.to)

// Splits [from, to) into plain and highlighted pieces, in order. Highlights never overlap.
export function segments(from: number, to: number, highlights: Anchored[]): Segment[] {
  const out: Segment[] = []; let at = from
  for (const h of highlights.filter(h => !h.lost && h.from < to && from < h.to).sort((a, b) => a.from - b.from)) {
    const start = Math.max(h.from, at), end = Math.min(h.to, to)
    if (start > at) out.push({ from: at, to: start })
    if (end > start) out.push({ from: start, to: end, highlight: h })
    at = Math.max(at, end)
  }
  if (at < to) out.push({ from: at, to })
  return out
}
