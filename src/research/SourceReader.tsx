import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../shared/api'
import type { Highlight, ResearchSource } from '../shared/types'
import type { Annotations } from './useResearch'
import { textBlocks } from './blocks'
import { anchor, overlaps, segments } from './anchor'

const message = (e: unknown) => e instanceof Error ? e.message : String(e)
export const highlightColors = [{ id: 1, name: 'Sand' }, { id: 2, name: 'Sage' }, { id: 3, name: 'Sky' }, { id: 4, name: 'Rose' }] as const
type Popover = { x: number; y: number; from: number; to: number; id?: string; noting: boolean; confirm?: boolean; problem?: string }

// Offset in the saved text for a DOM position inside a block rendered from [data-from].
function textOffset(root: HTMLElement, node: Node, offset: number) {
  const block = (node instanceof Element ? node : node.parentElement)?.closest<HTMLElement>('[data-from]')
  if (!block || !root.contains(block)) return null
  const range = document.createRange(); range.selectNodeContents(block); range.setEnd(node, offset)
  return Number(block.dataset.from) + range.toString().length
}

export function SourceReader({ projectId, source, back, reload, highlights, save, focusHighlight, onInsert, placeName }: { projectId: string; source: ResearchSource; back: () => void; reload: () => Promise<unknown>; highlights: Highlight[]; save: (change: (current: Annotations) => Partial<Annotations>) => Promise<void>; focusHighlight?: string; onInsert: (quote: string, highlightId?: string) => void; placeName: (sectionId: string | null) => string }) {
  const [text, setText] = useState<string | null>(null), [problem, setProblem] = useState('')
  const [popover, setPopover] = useState<Popover | null>(null), [note, setNote] = useState('')
  const heading = useRef<HTMLHeadingElement>(null), body = useRef<HTMLDivElement>(null), reader = useRef<HTMLElement>(null)
  useEffect(() => {
    let active = true
    void api.research<{ text: string }>(projectId, 'read-source', { sourceId: source.id }).then(result => { if (active) setText(result.text) }).catch(error => { if (active) setProblem(message(error)) })
    if (source.status === 'unread') void api.research(projectId, 'update-source', { sourceId: source.id, patch: { status: 'read' } }).then(reload).catch(() => {})
    heading.current?.focus()
    return () => { active = false }
  }, [projectId, source.id])
  const blocks = useMemo(() => text === null ? [] : textBlocks(text), [text])
  const anchored = useMemo(() => text === null ? [] : highlights.filter(h => h.sourceId === source.id).map(h => anchor(text, h)), [text, highlights, source.id])
  // While the popover is open, Esc closes only the popover, wherever focus is.
  useEffect(() => {
    if (!popover) return
    const escape = (event: globalThis.KeyboardEvent) => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); close() } }
    window.addEventListener('keydown', escape, true); return () => window.removeEventListener('keydown', escape, true)
  }, [popover])
  // Arriving from the Highlights tab: bring that highlight into view.
  useEffect(() => {
    if (text === null || !focusHighlight) return
    const mark = body.current?.querySelector<HTMLElement>(`[data-highlight="${CSS.escape(focusHighlight)}"]`)
    mark?.scrollIntoView({ block: 'center' }); mark?.focus()
  }, [text, focusHighlight])
  const places = [...new Set(source.usedIn.map(use => placeName(use.sectionId)))]
  const lost = anchored.filter(h => h.lost)
  const current = popover?.id ? anchored.find(h => h.id === popover.id) : undefined

  function place(rect: DOMRect) { const box = reader.current!.getBoundingClientRect(); return { x: Math.max(0, Math.min(rect.left - box.left, box.width - 260)), y: rect.top - box.top - 8 } }
  function selected() {
    const selection = getSelection()
    if (!text || !body.current || !selection || selection.isCollapsed || !selection.rangeCount) return
    const range = selection.getRangeAt(0)
    let from = textOffset(body.current, range.startContainer, range.startOffset), to = textOffset(body.current, range.endContainer, range.endOffset)
    if (from === null || to === null) return
    if (from > to) [from, to] = [to, from]
    while (from < to && /\s/.test(text[from])) from++
    while (to > from && /\s/.test(text[to - 1])) to--
    if (from === to) return
    setNote('')
    setPopover({ ...place(range.getBoundingClientRect()), from, to, noting: false, problem: overlaps(from, to, anchored) ? 'This overlaps a highlight. Select outside it.' : undefined })
  }
  function openExisting(id: string, element: HTMLElement) {
    const h = anchored.find(item => item.id === id)
    if (!h) return
    setNote(h.note ?? ''); setPopover({ ...place(element.getBoundingClientRect()), from: h.from, to: h.to, id, noting: false })
  }
  function close() { setPopover(null); getSelection()?.removeAllRanges() }
  async function apply(change: (list: Highlight[]) => Highlight[]) {
    // Close first: the writer may already be selecting the next passage while this one saves.
    close()
    try { await save(current => ({ highlights: change(current.highlights) })) } catch (error) { setProblem(message(error)) }
  }
  function create(color: Highlight['color'], withNote?: string) {
    if (!popover || !text) return
    const highlight: Highlight = { id: crypto.randomUUID(), sourceId: source.id, from: popover.from, to: popover.to, quote: text.slice(popover.from, popover.to), color, createdAt: new Date().toISOString(), ...(withNote?.trim() ? { note: withNote.trim() } : {}) }
    void apply(list => [...list, highlight])
  }
  const update = (patch: Partial<Highlight>) => void apply(list => list.map(h => h.id === popover!.id ? { ...h, ...patch } : h))

  return <article ref={reader} className="source-reader" aria-label={`Source: ${source.title}`}>
    <button className="text-link source-back" onClick={back}>← All sources</button>
    <div className="source-kind"><span className="type-chip">{source.type}</span>{source.origin === 'inbox' && <span>from the inbox</span>}{source.origin === 'ai-found' && <span className="ai-label">AI found</span>}</div>
    <h3 ref={heading} tabIndex={-1}>{source.title}</h3>
    <p className="source-meta">{[source.site, source.author, source.published ?? (source.saved && `saved ${source.saved}`)].filter(Boolean).join(' · ')}</p>
    {source.url && <p className="source-url" title="Original address">{source.url}</p>}
    {source.summary && <p className="source-summary">{source.summary}</p>}
    {places.length > 0 && <p className="source-used">Quoted in {places.join(', ')}</p>}
    {problem && <p className="research-problem" role="alert">{problem}</p>}
    {lost.length > 0 && <p className="quiet highlight-lost">{lost.length === 1 ? 'One highlight' : `${lost.length} highlights`} no longer match the saved text. {lost.length === 1 ? 'It is' : 'They are'} kept in Highlights.</p>}
    {text === null && !problem ? <p className="quiet">Opening the saved copy…</p> : <div ref={body} className="source-text" tabIndex={-1} onMouseUp={() => setTimeout(selected, 0)} onKeyUp={event => { if (event.shiftKey) selected() }}>
      {blocks.map(block => { const Tag = block.kind === 'quote' ? 'blockquote' : block.kind === 'code' ? 'pre' : block.kind; return <Tag key={block.from} data-from={block.from}>{segments(block.from, block.to, anchored).map(piece => piece.highlight
        ? <mark key={piece.from} className={`hl hl-${piece.highlight.color}${piece.highlight.note ? ' has-note' : ''}`} data-highlight={piece.highlight.id} tabIndex={0} title={piece.highlight.note} aria-label={`Highlight${piece.highlight.note ? `, note: ${piece.highlight.note}` : ''}`} onClick={event => { if (getSelection()?.isCollapsed) openExisting(piece.highlight!.id, event.currentTarget) }} onKeyDown={event => { if (event.key === 'Enter') openExisting(piece.highlight!.id, event.currentTarget) }}>{text!.slice(piece.from, piece.to)}</mark>
        : text!.slice(piece.from, piece.to))}</Tag> })}
    </div>}
    {popover && <div className="highlight-popover" role="dialog" aria-label={current ? 'Edit highlight' : 'Highlight selection'} style={{ left: popover.x, top: popover.y }} onMouseDown={event => { if (!(event.target instanceof HTMLTextAreaElement)) event.preventDefault() }}>
      {popover.problem ? <p>{popover.problem}</p> : <>
        <div className="highlight-colors">{highlightColors.map(color => <button key={color.id} className={`swatch hl-${color.id}`} aria-label={`${current ? 'Change to' : 'Highlight in'} ${color.name}`} aria-pressed={current?.color === color.id} onClick={() => current ? update({ color: color.id }) : create(color.id)}/>)}
          {!current && !popover.noting && <button className="popover-text" onClick={() => setPopover({ ...popover, noting: true })}>Add note</button>}
          <button className="popover-text insert-quote" onClick={() => { const quote = text!.slice(popover.from, popover.to), id = current?.id; close(); onInsert(quote, id) }}>Insert quote</button></div>
        {(current || popover.noting) && <div className="highlight-note"><label className="sr-only" htmlFor="highlight-note">Note</label><textarea id="highlight-note" autoFocus={popover.noting} rows={3} placeholder="Why this matters…" value={note} onChange={event => setNote(event.target.value)}/>
          <div className="popover-actions">{current ? <><button className="popover-text" onClick={() => update({ note: note.trim() || undefined })}>Save note</button><button className="popover-text danger" onClick={() => current.note && !popover.confirm ? setPopover({ ...popover, confirm: true }) : void apply(list => list.filter(h => h.id !== current.id))}>{popover.confirm ? 'Remove highlight and note' : 'Remove highlight'}</button></> : <button className="popover-text" onClick={() => create(1, note)}>Save with note</button>}</div></div>}
      </>}
    </div>}
  </article>
}
