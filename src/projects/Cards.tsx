import { useState } from 'react'
import type { ProjectCard } from '../shared/types'

export function Cards({ cards, change, disabled }: { cards: ProjectCard[]; change: (cards: ProjectCard[]) => void; disabled: boolean }) {
  const [kind, setKind] = useState<ProjectCard['kind']>('character')
  const [editing, setEditing] = useState<ProjectCard | null>(null)
  const [aliases, setAliases] = useState('')
  function open(card?: ProjectCard) {
    setEditing(card ? { ...card } : { id: crypto.randomUUID(), kind, name: '', summary: '', details: '', age: '', aliases: [] })
    setAliases(card?.aliases.join(', ') ?? '')
  }
  const active = cards.filter(c => c.kind === kind && !c.trashedAt)
  return <div className="cards-panel"><div className="section-label">THE PEOPLE &amp; PLACES</div><p className="quiet">Keep a few details close. Your cards stay with this project.</p>
    <div className="card-kind"><button className={kind === 'character' ? 'selected' : ''} onClick={() => { setKind('character'); setEditing(null) }}>Characters</button><button className={kind === 'place' ? 'selected' : ''} onClick={() => { setKind('place'); setEditing(null) }}>Places</button></div>
    {editing ? <form className="card-form" onSubmit={e => { e.preventDefault(); const next = { ...editing, name: editing.name.trim(), aliases: aliases.split(',').map(s => s.trim()).filter(Boolean) }; change(cards.some(c => c.id === next.id) ? cards.map(c => c.id === next.id ? next : c) : [...cards, next]); setEditing(null) }}>
      <label className="field">Card name<input autoFocus value={editing.name} required onChange={e => setEditing({ ...editing, name: e.target.value })}/></label>
      <label className="field">{editing.kind === 'character' ? 'Role / first impression' : 'Atmosphere / first impression'}<input value={editing.summary} onChange={e => setEditing({ ...editing, summary: e.target.value })}/></label>
      {editing.kind === 'character' && <label className="field">Age<input value={editing.age} onChange={e => setEditing({ ...editing, age: e.target.value })}/></label>}
      <label className="field">Aliases<input value={aliases} placeholder="Names, separated by commas" onChange={e => setAliases(e.target.value)}/></label>
      <label className="field">Details<textarea value={editing.details} placeholder="A habit, a memory, a detail to remember…" rows={6} onChange={e => setEditing({ ...editing, details: e.target.value })}/></label>
      <div className="card-form-actions"><button className="accent-button" disabled={disabled || !editing.name.trim()}>Save card</button><button type="button" onClick={() => setEditing(null)}>Cancel</button></div>
    </form> : <><button className="outline-button" disabled={disabled} onClick={() => open()}>+ {kind === 'character' ? 'Character' : 'Place'}</button><div className="project-cards">{active.map(card => <article className="project-card" key={card.id}><small>{card.kind === 'character' ? 'CHARACTER' : 'PLACE'}{card.age && ` · ${card.age}`}</small><h3>{card.name}</h3>{card.summary && <p>{card.summary}</p>}{card.aliases.length > 0 && <p className="quiet">Also {card.aliases.join(', ')}</p>}<p className="card-details">{card.details}</p><div><button onClick={() => open(card)} disabled={disabled}>Edit card</button><button onClick={() => change(cards.map(c => c.id === card.id ? { ...c, trashedAt: new Date().toISOString() } : c))} disabled={disabled}>Set aside</button></div></article>)}</div>{!active.length && <p className="quiet empty-preview">A face, a place, a small detail.</p>}</>}
    {cards.some(c => c.trashedAt) && <details className="card-trash"><summary>Set-aside cards</summary>{cards.filter(c => c.trashedAt).map(c => <div key={c.id}><span>{c.name}</span><button onClick={() => change(cards.map(item => item.id === c.id ? { ...item, trashedAt: undefined } : item))} disabled={disabled}>Restore card</button></div>)}</details>}
  </div>
}
