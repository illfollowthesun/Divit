import { useState } from 'react'
import type { Research, ResearchNote } from '../shared/types'
import type { Annotations } from './useResearch'

const message = (e: unknown) => e instanceof Error ? e.message : String(e)

// Free notes for the topic, in plain Markdown, optionally tied to a highlight. Notes are set aside, never deleted.
export function NotesTab({ research, save, openHighlight }: { research: Research; save: (change: (current: Annotations) => Partial<Annotations>) => Promise<void>; openHighlight: (highlightId: string) => void }) {
  const [editing, setEditing] = useState<ResearchNote | null>(null), [problem, setProblem] = useState('')
  const notes = research.notes.filter(n => !n.trashedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)), aside = research.notes.filter(n => n.trashedAt)
  const quoteFor = (id?: string) => research.highlights.find(h => h.id === id)?.quote
  async function write(change: (list: ResearchNote[]) => ResearchNote[]) {
    try { setProblem(''); await save(current => ({ notes: change(current.notes) })); setEditing(null) } catch (error) { setProblem(message(error)) }
  }
  function start(note?: ResearchNote) { const now = new Date().toISOString(); setEditing(note ? { ...note } : { id: crypto.randomUUID(), title: '', body: '', createdAt: now, updatedAt: now }) }
  if (editing) return <form className="research-note-form" onSubmit={event => { event.preventDefault(); const note = { ...editing, title: editing.title.trim(), updatedAt: new Date().toISOString() }; void write(list => list.some(n => n.id === note.id) ? list.map(n => n.id === note.id ? note : n) : [...list, note]) }}>
    <label className="field">Note title<input autoFocus value={editing.title} onChange={event => setEditing({ ...editing, title: event.target.value })}/></label>
    <label className="field">Note<textarea rows={8} placeholder="A question, a link between sources, what to check…" value={editing.body} onChange={event => setEditing({ ...editing, body: event.target.value })}/></label>
    <label className="field">Linked highlight<select value={editing.highlightId ?? ''} onChange={event => setEditing({ ...editing, highlightId: event.target.value || undefined })}><option value="">None</option>{research.highlights.map(h => <option key={h.id} value={h.id}>{h.quote.length > 60 ? `${h.quote.slice(0, 60)}…` : h.quote}</option>)}</select></label>
    {problem && <p className="research-problem" role="alert">{problem}</p>}
    <div className="card-form-actions"><button className="accent-button" disabled={!editing.title.trim() && !editing.body.trim()}>Save note</button><button type="button" onClick={() => setEditing(null)}>Cancel</button></div>
  </form>
  return <div className="notes-tab">
    <button className="outline-button" onClick={() => start()}>+ Note</button>
    {problem && <p className="research-problem" role="alert">{problem}</p>}
    {!notes.length && <p className="quiet research-empty">Your own notes for this topic. AI notes, when you ask for them, are kept apart.</p>}
    {notes.map(note => <article key={note.id} className="research-note">
      {note.migratedFrom && <small>from the Notebook</small>}<h4>{note.title || 'Untitled note'}</h4>{note.body && <p>{note.body}</p>}
      {note.highlightId && quoteFor(note.highlightId) && <button className="linked-quote" onClick={() => openHighlight(note.highlightId!)}>“{quoteFor(note.highlightId)}”</button>}
      <div className="highlight-actions"><button className="popover-text" onClick={() => start(note)}>Edit</button><button className="popover-text" onClick={() => void write(list => list.map(n => n.id === note.id ? { ...n, trashedAt: new Date().toISOString() } : n))}>Set aside</button></div>
    </article>)}
    {aside.length > 0 && <details className="card-trash"><summary>Set-aside notes</summary>{aside.map(note => <div key={note.id}><span>{note.title || 'Untitled note'}</span><button onClick={() => void write(list => list.map(n => n.id === note.id ? { ...n, trashedAt: undefined } : n))}>Restore note</button></div>)}</details>}
  </div>
}
