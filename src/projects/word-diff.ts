export type WordChange = { kind: 'equal' | 'removed' | 'added'; text: string }
const tokenize = (text: string) => text.match(/\s+|[\p{L}\p{M}\p{N}_]+|[^\p{L}\p{M}\p{N}_\s]/gu) ?? []
function middle(a: string[], b: string[]): WordChange[] {
  if (!a.length) return b.map(text => ({ kind: 'added', text }))
  if (!b.length) return a.map(text => ({ kind: 'removed', text }))
  const front = new Map<number, number>([[1, 0]]), trace: Map<number, number>[] = []
  for (let d = 0; d <= Math.min(a.length + b.length, 512); d++) {
    trace.push(new Map(front))
    for (let k = -d; k <= d; k += 2) {
      let x = k === -d || k !== d && (front.get(k - 1) ?? -1) < (front.get(k + 1) ?? -1) ? front.get(k + 1) ?? 0 : (front.get(k - 1) ?? 0) + 1
      let y = x - k
      while (x < a.length && y < b.length && a[x] === b[y]) { x++; y++ }
      front.set(k, x)
      if (x >= a.length && y >= b.length) {
        const changes: WordChange[] = []; x = a.length; y = b.length
        for (let depth = trace.length - 1; depth >= 0; depth--) {
          const v = trace[depth], diagonal = x - y
          const previous = diagonal === -depth || diagonal !== depth && (v.get(diagonal - 1) ?? -1) < (v.get(diagonal + 1) ?? -1) ? diagonal + 1 : diagonal - 1
          const px = v.get(previous) ?? 0, py = px - previous
          while (x > px && y > py) { changes.push({ kind: 'equal', text: a[x - 1] }); x--; y-- }
          if (!depth) break
          if (x === px) { changes.push({ kind: 'added', text: b[y - 1] }); y-- }
          else { changes.push({ kind: 'removed', text: a[x - 1] }); x-- }
        }
        return changes.reverse()
      }
    }
  }
  // Bound work for a wholesale chapter rewrite, preserving its unchanged edges.
  return [...a.map(text => ({ kind: 'removed' as const, text })), ...b.map(text => ({ kind: 'added' as const, text }))]
}
export function wordDiff(before: string, after: string): WordChange[] {
  const a = tokenize(before), b = tokenize(after); let start = 0, end = 0
  while (start < Math.min(a.length, b.length) && a[start] === b[start]) start++
  while (end < Math.min(a.length, b.length) - start && a[a.length - end - 1] === b[b.length - end - 1]) end++
  const changes: WordChange[] = [
    { kind: 'equal', text: a.slice(0, start).join('') },
    ...middle(a.slice(start, a.length - end), b.slice(start, b.length - end)),
    { kind: 'equal', text: end ? a.slice(a.length - end).join('') : '' },
  ]
  const merged: WordChange[] = []
  for (const change of changes) if (change.text) { const last = merged[merged.length - 1]; if (last?.kind === change.kind) last.text += change.text; else merged.push({ ...change }) }
  return merged
}
