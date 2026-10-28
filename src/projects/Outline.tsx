import type { Project, Section } from '../shared/types'
import { addSection, moveSection, dropSection, archiveSection, restoreSection, orderedSections } from './manuscript'

export function Outline({ project, selected, choose, change, disabled }: { project: Project; selected: string | null; choose: (id: string | null) => void; change: (sections: Section[]) => void; disabled: boolean }) {
  const active = orderedSections(project), trash = (project.sections ?? []).filter(n => n.trashedAt)
  const current = active.find(n => n.id === selected)
  function add(kind: Section['kind']) { const result = addSection(project, kind, selected); change(result.sections); choose(result.id) }
  return <section className="outline" aria-label="Manuscript outline"><div className="section-label">MANUSCRIPT <span>{active.length}</span></div>
    <button className={`outline-node ${!selected ? 'selected' : ''}`} onClick={() => choose(null)} disabled={disabled}>{project.type === 'story' ? 'Single text' : 'Opening'}</button>
    <div className="outline-tree">{active.map(node => <div key={node.id} className={`outline-row ${node.parentId ? 'child' : ''}`} draggable={!disabled} onDragStart={e => e.dataTransfer.setData('text/yazi-section', node.id)} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); if (!disabled) change(dropSection(project, e.dataTransfer.getData('text/yazi-section'), node.id)) }}><button className={`outline-node ${node.id === selected ? 'selected' : ''}`} onClick={() => choose(node.id)} disabled={disabled}><small>{node.kind === 'chapter' ? 'CH' : 'SC'}</small><span>{node.title}</span></button></div>)}</div>
    <div className="outline-add">{project.type === 'book' && <button onClick={() => add('chapter')} disabled={disabled}>+ Chapter</button>}<button onClick={() => add('scene')} disabled={disabled || project.type === 'book' && !active.some(n => n.kind === 'chapter')}>+ Scene</button></div>
    {current && <div className="outline-tools"><button aria-label={`Move ${current.title} up`} onClick={() => change(moveSection(project, current.id, -1))} disabled={disabled}>↑</button><button aria-label={`Move ${current.title} down`} onClick={() => change(moveSection(project, current.id, 1))} disabled={disabled}>↓</button><button onClick={() => { change(archiveSection(project, current.id)); choose(null) }} disabled={disabled}>Set aside</button></div>}
    {trash.length > 0 && <details className="outline-trash"><summary>Set aside ({trash.length})</summary>{trash.filter(n => !n.parentId || !trash.some(p => p.id === n.parentId)).map(n => <div key={n.id}><span>{n.title}</span><button onClick={() => change(restoreSection(project, n.id))} disabled={disabled}>Restore</button></div>)}</details>}
  </section>
}
