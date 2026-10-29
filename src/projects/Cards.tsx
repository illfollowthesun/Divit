import { useEffect, useRef, useState } from 'react'
import type { ProjectCard } from '../shared/types'
import { t } from '../i18n'

export function Cards({ cards, change, disabled, selectedId }: { cards: ProjectCard[]; change: (cards: ProjectCard[]) => void; disabled: boolean; selectedId?: string | null }) {
  const [kind, setKind] = useState<ProjectCard['kind']>('character')
  const [editing, setEditing] = useState<ProjectCard | null>(null)
  const [aliases, setAliases] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const panel = useRef<HTMLDivElement>(null)
  useEffect(() => { const selected = cards.find(c => c.id === selectedId && !c.trashedAt); if (selected) { setKind(selected.kind); setEditing(null) } }, [selectedId, cards])
  useEffect(() => { if (selectedId) panel.current?.querySelector(`[data-card="${CSS.escape(selectedId)}"]`)?.scrollIntoView({ block: 'nearest' }) }, [selectedId, kind])
  function open(card?: ProjectCard) {
    setEditing(card ? { ...card } : { id: crypto.randomUUID(), kind, name: '', summary: '', details: '', age: '', aliases: [] })
    setAliases(card?.aliases.join(', ') ?? '')
  }
  const active = cards.filter(c => c.kind === kind && !c.trashedAt)
  return <div className="cards-panel" ref={panel}><div className="section-label">{t('THE PEOPLE & PLACES')}</div><p className="quiet">{t('Keep a few details close. Your cards stay with this project.')}</p>
    <div className="card-kind"><button className={kind === 'character' ? 'selected' : ''} onClick={() => { setKind('character'); setEditing(null) }}>{t('Characters')}</button><button className={kind === 'place' ? 'selected' : ''} onClick={() => { setKind('place'); setEditing(null) }}>{t('Places')}</button></div>
    {editing ? <form className="card-form" onSubmit={e => { e.preventDefault(); const next = { ...editing, name: editing.name.trim(), aliases: aliases.split(',').map(s => s.trim()).filter(Boolean) }; change(cards.some(c => c.id === next.id) ? cards.map(c => c.id === next.id ? next : c) : [...cards, next]); setEditing(null) }}>
      <label className="field">{t('Card name')}<input autoFocus value={editing.name} required onChange={e => setEditing({ ...editing, name: e.target.value })}/></label>
      <label className="field">{editing.kind === 'character' ? t('Role / first impression') : t('Atmosphere / first impression')}<input value={editing.summary} onChange={e => setEditing({ ...editing, summary: e.target.value })}/></label>
      {editing.kind === 'character' && <label className="field">{t('Age')}<input value={editing.age} onChange={e => setEditing({ ...editing, age: e.target.value })}/></label>}
      <label className="field">{t('Aliases')}<input value={aliases} placeholder={t('Names, separated by commas')} onChange={e => setAliases(e.target.value)}/></label>
      <label className="field">{t('Details')}<textarea value={editing.details} placeholder={t('A habit, a memory, a detail to remember…')} rows={6} onChange={e => setEditing({ ...editing, details: e.target.value })}/></label>
      <div className="card-form-actions"><button className="accent-button" disabled={disabled || !editing.name.trim()}>{t('Save card')}</button><button type="button" onClick={() => setEditing(null)}>{t('Cancel')}</button></div>
    </form> : <><button className="outline-button" disabled={disabled} onClick={() => open()}>+ {kind === 'character' ? t('Character') : t('Place')}</button><div className="project-cards">{active.map(card => <article className={`project-card ${selectedId === card.id ? 'card-selected' : ''}`} key={card.id} data-card={card.id}><small>{card.kind === 'character' ? t('CHARACTER') : t('PLACE')}{card.age && ` · ${card.age}`}</small><h3>{card.name}</h3>{card.summary && <p>{card.summary}</p>}{card.aliases.length > 0 && <p className="quiet">{t('Also {names}', { names: card.aliases.join(', ') })}</p>}<p className="card-details">{expanded === card.id || card.details.length <= 180 ? card.details : card.details.slice(0, 180) + '\u2026'}</p>{card.details.length > 180 && <button className="card-more" onClick={() => setExpanded(expanded === card.id ? null : card.id)}>{expanded === card.id ? t('Less') : t('More')}</button>}<div><button onClick={() => open(card)} disabled={disabled}>{t('Edit card')}</button><button onClick={() => change(cards.map(c => c.id === card.id ? { ...c, trashedAt: new Date().toISOString() } : c))} disabled={disabled}>{t('Set aside')}</button></div></article>)}</div>{!active.length && <p className="quiet empty-preview">{t('A face, a place, a small detail.')}</p>}</>}
    {cards.some(c => c.trashedAt) && <details className="card-trash"><summary>{t('Set-aside cards')}</summary>{cards.filter(c => c.trashedAt).map(c => <div key={c.id}><span>{c.name}</span><button onClick={() => change(cards.map(item => item.id === c.id ? { ...item, trashedAt: undefined } : item))} disabled={disabled}>{t('Restore card')}</button></div>)}</details>}
  </div>
}
