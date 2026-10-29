import type { Project, WritingDay } from '../shared/types'
import { words } from '../shared/types.ts'
export function localDay(now = new Date()): string { return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10) }
// Net words written on one day across the given projects, never below zero.
export function wordsOn(projects: Pick<Project, 'writingLog'>[], day: string): number {
  return Math.max(0, projects.reduce((sum, p) => { const row = p.writingLog?.find(r => r.date === day); return sum + (row ? row.added - row.removed : 0) }, 0))
}
// Days in a row on which any words were added, in any project. It counts back from today, or from
// yesterday while today is still empty, so the count does not drop before the first sentence.
export function streak(projects: Pick<Project, 'writingLog'>[], today = localDay()): number {
  const days = new Set(projects.flatMap(p => (p.writingLog ?? []).filter(r => r.added > 0).map(r => r.date)))
  const day = new Date(`${today}T12:00:00`)
  if (!days.has(today)) day.setDate(day.getDate() - 1)
  let count = 0
  while (days.has(localDay(day))) { count++; day.setDate(day.getDate() - 1) }
  return count
}
export function recordWriting(project: Project, before: string, after: string, date = localDay()): WritingDay[] {
  const delta = words(after) - words(before), log = project.writingLog ?? []
  if (!delta) return log
  const today = log.find(row => row.date === date) ?? { date, added: 0, removed: 0 }
  const next = { ...today, added: today.added + Math.max(0, delta), removed: today.removed + Math.max(0, -delta) }
  return [...log.filter(row => row.date !== date), next].sort((a, b) => a.date.localeCompare(b.date))
}
