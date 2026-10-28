import { useMemo, useState } from 'react'
import DOMPurify from 'dompurify'
import { marked, Renderer } from 'marked'
import { wordDiff } from './word-diff'

function documentFor(text: string) {
  const node = document.createElement('div'), renderer = new Renderer()
  renderer.image = ({ text }: { text: string }) => `[Image: ${text.replace(/[<>&]/g, '')}]`
  node.innerHTML = DOMPurify.sanitize(marked.parse(text, { async: false, renderer }), { ALLOWED_TAGS: ['p','h1','h2','h3','h4','h5','h6','strong','em','s','code','pre','blockquote','ul','ol','li','a','br','hr','table','thead','tbody','tr','th','td'], ALLOWED_ATTR: [] })
  return node
}
function highlight(node: HTMLElement, ranges: { from: number; to: number }[], side: 'removed' | 'added', onlyChanges: boolean) {
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT), texts: Text[] = []
  while (walker.nextNode()) texts.push(walker.currentNode as Text)
  let offset = 0, rangeIndex = 0
  for (const text of texts) {
    const value = text.data, end = offset + value.length, fragment = document.createDocumentFragment(); let cursor = 0
    while (rangeIndex < ranges.length && ranges[rangeIndex].to <= offset) rangeIndex++
    for (let i = rangeIndex; i < ranges.length && ranges[i].from < end; i++) {
      const start = Math.max(0, ranges[i].from - offset), finish = Math.min(value.length, ranges[i].to - offset)
      fragment.append(document.createTextNode(value.slice(cursor, start)))
      const mark = document.createElement(side === 'removed' ? 'del' : 'ins'); mark.className = `diff-${side}`; mark.textContent = value.slice(start, finish); fragment.append(mark); cursor = finish
    }
    fragment.append(document.createTextNode(value.slice(cursor))); text.replaceWith(fragment); offset = end
  }
  if (onlyChanges) for (const child of [...node.children]) if (!child.matches('del,ins') && !child.querySelector('del,ins')) child.remove()
  return node.innerHTML
}
export function SnapshotDiff({ before, after, beforeTitle, afterTitle }: { before: string; after: string; beforeTitle: string; afterTitle: string }) {
  const [onlyChanges, setOnlyChanges] = useState(false)
  const result = useMemo(() => {
    const old = documentFor(before), current = documentFor(after), changes = wordDiff(old.textContent ?? '', current.textContent ?? '')
    const removed: { from: number; to: number }[] = [], added: { from: number; to: number }[] = []; let a = 0, b = 0
    for (const change of changes) {
      if (change.kind === 'removed') { removed.push({ from: a, to: a + change.text.length }); a += change.text.length }
      else if (change.kind === 'added') { added.push({ from: b, to: b + change.text.length }); b += change.text.length }
      else { a += change.text.length; b += change.text.length }
    }
    return { before: highlight(old, removed, 'removed', onlyChanges), after: highlight(current, added, 'added', onlyChanges), changed: removed.length + added.length > 0 }
  }, [before, after, onlyChanges])
  return <><div className="diff-options"><label><input type="checkbox" checked={onlyChanges} onChange={e => setOnlyChanges(e.target.checked)}/> Only show changes</label><span><del className="diff-removed">Removed</del> <ins className="diff-added">Added</ins></span></div>{!result.changed && <p className="quiet">No text changes.</p>}<div className="snapshot-comparison"><section><div className="section-label">KEPT VERSION</div><h3>{beforeTitle}</h3><div className="snapshot-document" dangerouslySetInnerHTML={{ __html: result.before }}/></section><section><div className="section-label">CURRENT WRITING</div><h3>{afterTitle}</h3><div className="snapshot-document" dangerouslySetInnerHTML={{ __html: result.after }}/></section></div></>
}
