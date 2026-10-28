import type { Project, Snapshot, Section } from '../shared/types'
import { orderedSections } from './manuscript.ts'

export function takeSnapshot(project: Project, scopeId: string | null, label: string): Snapshot {
  const scope = scopeId ? project.sections?.find(n => n.id === scopeId) : null
  if (scopeId && !scope) throw new Error('The section no longer exists.')
  const sections = scope ? (project.sections ?? []).filter(n => n.id === scope.id || n.parentId === scope.id) : orderedSections(project)
  return { id: crypto.randomUUID(), scopeId, title: scope?.title || project.title || 'Untitled', label: label.trim() || 'Before a rewrite', createdAt: new Date().toISOString(), body: scope?.body ?? project.body, sections: structuredClone(sections) }
}
export function snapshotText(snapshot: Snapshot): string {
  if (snapshot.scopeId) return [snapshot.body, ...snapshot.sections.filter(n => n.id !== snapshot.scopeId && !n.trashedAt).map(n => `## ${n.title}\n\n${n.body}`)].filter(Boolean).join('\n\n')
  return [snapshot.body, ...snapshot.sections.filter(n => !n.trashedAt).map(n => `${n.kind === 'chapter' ? '#' : '##'} ${n.title}\n\n${n.body}`)].filter(Boolean).join('\n\n')
}
export function restoreSnapshot(project: Project, snapshot: Snapshot): Project {
  // Restoring itself always creates a safeguard: both versions remain recoverable.
  const safeguard = takeSnapshot(project, snapshot.scopeId, `Before restoring: ${snapshot.label}`)
  const captured = structuredClone(snapshot.sections).map(n => ({ ...n, trashedAt: undefined }))
  const capturedIds = new Set(captured.map(n => n.id))
  const current = project.sections ?? [], at = snapshot.scopeId ? Math.max(0, current.findIndex(n => n.id === snapshot.scopeId)) : 0
  const inScope = (n: Section) => snapshot.scopeId === null || n.id === snapshot.scopeId || n.parentId === snapshot.scopeId || capturedIds.has(n.id)
  const removed = current.filter(n => inScope(n) && !capturedIds.has(n.id)).map(n => ({ ...n, trashedAt: n.trashedAt ?? new Date().toISOString() }))
  const before = current.slice(0, at).filter(n => !inScope(n)), after = current.slice(at).filter(n => !inScope(n))
  const parents = new Set(captured.map(n => n.parentId).filter(Boolean))
  const sections = [...before, ...captured, ...removed, ...after].map(n => parents.has(n.id) ? { ...n, trashedAt: undefined } : n)
  return { ...project, body: snapshot.scopeId ? project.body : snapshot.body, sections, snapshots: [...(project.snapshots ?? []), safeguard] }
}
