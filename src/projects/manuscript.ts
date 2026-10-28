import type { Project, Section } from '../shared/types'

export function orderedSections(project: Project): Section[] {
  const all = project.sections ?? []
  return all.filter(n => !n.trashedAt && !n.parentId).flatMap(n => [n, ...all.filter(c => !c.trashedAt && c.parentId === n.id)])
}
export function manuscriptText(project: Project): string {
  const parts = [project.body.trim(), ...orderedSections(project).map(n => `${n.kind === 'chapter' || project.type === 'story' ? '#' : '##'} ${n.title}\n\n${n.body.trim()}`)]
  return parts.filter(Boolean).join('\n\n')
}
export function addSection(project: Project, kind: Section['kind'], selectedId: string | null): { sections: Section[]; id: string } {
  if (project.type === 'blog' || project.type === 'story' && kind === 'chapter') throw new Error('This project does not use chapters.')
  const sections = project.sections ?? []
  let parentId: string | undefined
  if (project.type === 'book' && kind === 'scene') {
    const selected = sections.find(n => n.id === selectedId && !n.trashedAt)
    parentId = selected?.kind === 'chapter' ? selected.id : selected?.parentId ?? sections.find(n => n.kind === 'chapter' && !n.trashedAt)?.id
    if (!parentId) throw new Error('Add a chapter before adding a scene.')
  }
  const number = sections.filter(n => !n.trashedAt && n.kind === kind && n.parentId === parentId).length + 1
  const node: Section = { id: crypto.randomUUID(), kind, parentId, title: `${kind === 'chapter' ? 'Chapter' : 'Scene'} ${number}`, body: '' }
  return { sections: [...sections, node], id: node.id }
}
export function moveSection(project: Project, id: string, direction: -1 | 1): Section[] {
  const all = [...(project.sections ?? [])]; const source = all.find(n => n.id === id && !n.trashedAt)
  if (!source) throw new Error('Section not found.')
  const siblings = all.filter(n => !n.trashedAt && n.parentId === source.parentId && n.kind === source.kind)
  const target = siblings[siblings.indexOf(source) + direction]
  if (!target) return all
  const a = all.indexOf(source), b = all.indexOf(target); [all[a], all[b]] = [all[b], all[a]]
  return all
}
export function dropSection(project: Project, id: string, targetId: string): Section[] {
  const all = [...(project.sections ?? [])]
  const source = all.find(n => n.id === id && !n.trashedAt), target = all.find(n => n.id === targetId && !n.trashedAt)
  if (!source || !target || source.id === target.id) return all
  if (source.kind === 'chapter' && target.kind !== 'chapter') return all
  const parentId = source.kind === 'scene' ? target.kind === 'chapter' ? target.id : target.parentId : undefined
  const movingDown = all.indexOf(source) < all.indexOf(target)
  const next = all.filter(n => n.id !== source.id)
  next.splice(next.findIndex(n => n.id === target.id) + (movingDown || target.kind === 'chapter' && source.kind === 'scene' ? 1 : 0), 0, { ...source, parentId })
  return next
}
export function archiveSection(project: Project, id: string): Section[] {
  const time = new Date().toISOString()
  return (project.sections ?? []).map(n => n.id === id || n.parentId === id ? { ...n, trashedAt: time } : n)
}
export function restoreSection(project: Project, id: string): Section[] {
  const all = project.sections ?? [], source = all.find(n => n.id === id)
  if (!source) throw new Error('Section not found.')
  return all.map(n => n.id === id || n.parentId === id || n.id === source.parentId ? { ...n, trashedAt: undefined } : n)
}
