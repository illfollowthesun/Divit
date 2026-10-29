import { StateEffect, StateField } from '@codemirror/state'
import { Decoration, EditorView } from '@codemirror/view'
import type { Issue } from '../modes/checker'
import { mapIssues, sameOccurrence } from '../modes/issues.ts'

export const setCheckIssues = StateEffect.define<Issue[]>()
export const ignoreCheckIssue = StateEffect.define<Issue>()
export const enableChecks = StateEffect.define<boolean>()

export const checkIssues = StateField.define<{ issues: Issue[]; ignored: Issue[]; enabled: boolean }>({
  create: () => ({ issues: [], ignored: [], enabled: false }),
  update(value, transaction) {
    let { issues, ignored, enabled } = value
    if (transaction.docChanged) {
      const text = transaction.newDoc.toString()
      issues = mapIssues(issues, transaction.changes, text)
      ignored = mapIssues(ignored, transaction.changes, text)
    }
    for (const effect of transaction.effects) {
      if (effect.is(enableChecks)) { enabled = effect.value; if (!enabled) issues = [] }
      if (effect.is(ignoreCheckIssue)) { ignored = [...ignored, effect.value]; issues = issues.filter(issue => !sameOccurrence(issue, effect.value)) }
      if (effect.is(setCheckIssues)) issues = enabled ? effect.value.filter(issue => !ignored.some(item => sameOccurrence(item, issue))) : []
    }
    return { issues, ignored, enabled }
  },
  provide: field => EditorView.decorations.from(field, value => Decoration.set(value.issues.map(issue => Decoration.mark({ class: `cm-${issue.type === 'spelling' ? 'misspelled' : issue.type}`, word: issue.original, language: issue.language }).range(issue.from, issue.to)), true)),
})

export function currentIssue(view: EditorView, issue: Issue) {
  return view.state.field(checkIssues).issues.some(current => current.id === issue.id && sameOccurrence(current, issue)) && view.state.sliceDoc(issue.from, issue.to) === issue.original
}

export function acceptCheckIssue(view: EditorView, issue: Issue, replacement: string) {
  if (!currentIssue(view, issue)) return false
  view.dispatch({ changes: { from: issue.from, to: issue.to, insert: replacement }, selection: { anchor: issue.from + replacement.length }, userEvent: 'input.spelling' }); view.focus()
  return true
}
