// Splits a saved source into display blocks whose [from, to) are exact offsets in the saved text,
// so a selection in the reader maps back onto the file without guessing.
export type Block = { kind: 'p' | 'h1' | 'h2' | 'h3' | 'li' | 'quote' | 'code'; from: number; to: number }

export function textBlocks(text: string): Block[] {
  const blocks: Block[] = []
  let offset = 0, paragraph: Block | null = null, fence: Block | null = null
  for (const line of text.split('\n')) {
    const start = offset, end = offset + line.length; offset = end + 1
    if (fence) {
      if (/^\s*```/.test(line)) { blocks.push(fence); fence = null }
      else { if (fence.from < 0) fence.from = start; fence.to = end }
      continue
    }
    if (/^\s*```/.test(line)) { if (paragraph) blocks.push(paragraph); paragraph = null; fence = { kind: 'code', from: -1, to: -1 }; continue }
    if (!line.trim()) { if (paragraph) blocks.push(paragraph); paragraph = null; continue }
    const marker = /^(#{1,6})\s+|^\s*(?:[-*+]|\d+[.)])\s+|^\s*>\s?/.exec(line)
    if (marker) {
      if (paragraph) blocks.push(paragraph); paragraph = null
      const kind = marker[1] ? (`h${Math.min(3, marker[1].length)}` as Block['kind']) : marker[0].trim().startsWith('>') ? 'quote' : 'li'
      if (start + marker[0].length < end) blocks.push({ kind, from: start + marker[0].length, to: end })
      continue
    }
    if (paragraph) paragraph.to = end; else paragraph = { kind: 'p', from: start, to: end }
  }
  if (paragraph) blocks.push(paragraph)
  if (fence && fence.from !== -1) blocks.push(fence)
  return blocks.filter(b => b.from >= 0 && b.to > b.from)
}
