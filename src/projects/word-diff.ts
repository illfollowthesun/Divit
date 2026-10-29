export type WordChange = { kind: 'equal' | 'removed' | 'added'; text: string }
const tokenize = (text: string) => text.match(/\s+|[\p{L}\p{M}\p{N}_]+|[^\p{L}\p{M}\p{N}_\s]/gu) ?? []
const blocks = (text: string) => text.split(/(\n+)/).filter(Boolean)

// Myers' O((N+M)D) diff over tokens; null when more than `limit` edits are needed.
function middle(a: string[], b: string[], limit: number): WordChange[] | null {
  if (!a.length) return b.map(text => ({ kind: 'added', text }))
  if (!b.length) return a.map(text => ({ kind: 'removed', text }))
  const front = new Map<number, number>([[1, 0]]), trace: Map<number, number>[] = []
  for (let d = 0; d <= Math.min(a.length + b.length, limit); d++) {
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
  return null
}
function tokens(a: string[], b: string[], limit: number): WordChange[] {
  let start = 0, end = 0
  while (start < Math.min(a.length, b.length) && a[start] === b[start]) start++
  while (end < Math.min(a.length, b.length) - start && a[a.length - end - 1] === b[b.length - end - 1]) end++
  const innerA = a.slice(start, a.length - end), innerB = b.slice(start, b.length - end)
  // Bound work for a wholesale rewrite, preserving its unchanged edges.
  const inner = middle(innerA, innerB, limit) ?? [...innerA.map(text => ({ kind: 'removed' as const, text })), ...innerB.map(text => ({ kind: 'added' as const, text }))]
  return [{ kind: 'equal', text: a.slice(0, start).join('') }, ...inner, { kind: 'equal', text: a.slice(a.length - end).join('') }]
}
// Between two equalities, list removed text first and added text second, as one change each.
function group(changes: WordChange[]) {
  const out: WordChange[] = []; let removed = '', added = ''
  const flush = () => { if (removed) out.push({ kind: 'removed', text: removed }); if (added) out.push({ kind: 'added', text: added }); removed = added = '' }
  for (const change of changes) {
    if (!change.text) continue
    if (change.kind === 'removed') removed += change.text
    else if (change.kind === 'added') added += change.text
    else { flush(); const last = out[out.length - 1]; if (last?.kind === 'equal') last.text += change.text; else out.push({ ...change }) }
  }
  flush(); return out
}
const editSize = (changes: WordChange[], from: number, step: number) => {
  let removed = 0, added = 0
  for (let i = from; i >= 0 && i < changes.length && changes[i].kind !== 'equal'; i += step) changes[i].kind === 'removed' ? removed += changes[i].text.length : added += changes[i].text.length
  return Math.max(removed, added)
}
// A short equality squeezed between two edits ("the", a space) is folded into them, so a rewritten
// sentence reads as one change instead of confetti. Paragraph breaks always stay.
function cleanup(changes: WordChange[]) {
  let list = group(changes)
  for (let i = 1; i < list.length - 1; i++) {
    const equal = list[i]
    if (equal.kind !== 'equal' || equal.text.includes('\n') || equal.text.length > editSize(list, i - 1, -1) || equal.text.length > editSize(list, i + 1, 1)) continue
    list = group([...list.slice(0, i), { kind: 'removed', text: equal.text }, { kind: 'added', text: equal.text }, ...list.slice(i + 1)])
    i = Math.max(0, i - 3) // Only neighbours can change; re-check them.
  }
  return list
}
export function wordDiff(before: string, after: string): WordChange[] {
  // Compare paragraphs first, then words inside each changed stretch, so many small edits across a
  // long chapter keep their word-level detail.
  const coarse = group(tokens(blocks(before), blocks(after), 4000)), fine: WordChange[] = []
  for (let i = 0; i < coarse.length; i++) {
    const change = coarse[i], next = coarse[i + 1]
    if (change.kind === 'removed' && next?.kind === 'added') { fine.push(...tokens(tokenize(change.text), tokenize(next.text), 512)); i++ }
    else fine.push(change)
  }
  return cleanup(fine)
}
