import type { ChangeDesc } from '@codemirror/state'
import type { Issue } from './checker'
import { fold } from '../spell/words.ts'

export type IgnoreRule = { engine: string; rule: string; language: Issue['language']; word?: string }

export function ruleFor(issue: Issue): IgnoreRule {
  return { engine: issue.engine, rule: issue.rule, language: issue.language, ...(issue.type === 'spelling' ? { word: fold(issue.original, issue.language) } : {}) }
}

// Shared by every checker: spelling ignores name a word; grammar/style ignores name a rule.
export function ignoredByRule(issue: Issue, rules: readonly IgnoreRule[]) {
  return rules.some(rule => rule.engine === issue.engine && rule.rule === issue.rule && rule.language === issue.language && (rule.word === undefined || rule.word === fold(issue.original, issue.language)))
}

export const sameOccurrence = (a: Issue, b: Issue) => a.from === b.from && a.to === b.to && a.original === b.original && a.language === b.language && a.engine === b.engine && a.rule === b.rule

// Map the exact occurrence through editor transactions. Never search for a nearby repeated word.
// Any edit inside an issue invalidates it; a fresh scan may create a new issue later.
export function mapIssues(issues: readonly Issue[], changes: ChangeDesc, text: string): Issue[] {
  return issues.flatMap(issue => {
    let touched = false
    changes.iterChangedRanges((from, to) => {
      if (from === to ? from > issue.from && from < issue.to : from < issue.to && to > issue.from) touched = true
    })
    if (touched) return []
    const from = changes.mapPos(issue.from, 1), to = changes.mapPos(issue.to, -1)
    if (from >= to || text.slice(from, to) !== issue.original) return []
    // A letter attached at an edge changes the token even if the old substring still exists.
    if (/[\p{L}\p{M}'’]/u.test(text[from - 1] ?? '') || /[\p{L}\p{M}'’]/u.test(text[to] ?? '')) return []
    return [{ ...issue, from, to }]
  })
}
