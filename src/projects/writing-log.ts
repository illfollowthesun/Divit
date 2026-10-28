import type { Project, WritingDay } from '../shared/types'
import { words } from '../shared/types.ts'
export function localDay(now = new Date()): string { return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10) }
export function recordWriting(project: Project, before: string, after: string, date = localDay()): WritingDay[] {
  const delta = words(after) - words(before), log = project.writingLog ?? []
  if (!delta) return log
  const today = log.find(row => row.date === date) ?? { date, added: 0, removed: 0 }
  const next = { ...today, added: today.added + Math.max(0, delta), removed: today.removed + Math.max(0, -delta) }
  return [...log.filter(row => row.date !== date), next].sort((a, b) => a.date.localeCompare(b.date))
}
