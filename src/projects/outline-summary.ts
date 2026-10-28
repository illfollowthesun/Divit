import type { Project } from '../shared/types'
import { words } from '../shared/types.ts'
export function sectionWords(project: Project, id: string): number {
  const all = project.sections ?? [], node = all.find(n => n.id === id)
  if (!node || node.trashedAt || node.parentId && all.find(n => n.id === node.parentId)?.trashedAt) return 0
  return words(node.body) + (node.kind === 'chapter' ? all.filter(n => n.parentId === id && !n.trashedAt).reduce((sum, n) => sum + words(n.body), 0) : 0)
}
