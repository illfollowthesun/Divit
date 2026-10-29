import test from 'node:test'
import assert from 'node:assert/strict'
import { ChangeSet, EditorState } from '@codemirror/state'
import { mapIssues, ruleFor, ignoredByRule } from '../src/modes/issues.ts'
import { checkIssues, enableChecks, setCheckIssues, ignoreCheckIssue, acceptCheckIssue } from '../src/editor/check-issues.ts'

const issue = (from = 4) => ({ id: 'one', from, to: from + 9, original: 'misspelld', language: 'en', engine: 'hunspell', rule: 'unknown-word', type: 'spelling', message: 'Spelling' })
const initial = 'The misspelld word. Another misspelld word.'
function mapped(text, items, change) {
  const changes = ChangeSet.of(change, text.length)
  const updated = changes.apply(EditorState.create({ doc: text }).doc).toString()
  return { text: updated, issues: mapIssues(items, changes, updated) }
}

test('issues track exact occurrences through edits, including UTF-16 offsets', () => {
  const next = mapped(initial, [issue()], { from: 0, insert: 'İstanbul 🌿. ' })
  assert.equal(next.issues.length, 1)
  assert.equal(next.issues[0].from, 17)
  assert.equal(next.text.slice(next.issues[0].from, next.issues[0].to), 'misspelld')
  assert.equal(mapped(initial, [issue()], { from: 7, to: 8, insert: 'x' }).issues.length, 0)
  assert.equal(mapped(initial, [issue()], { from: 4, to: 13 }).issues.length, 0, 'never jumps to the second occurrence')
  assert.equal(mapped(initial, [issue()], { from: 13, insert: 's' }).issues.length, 0, 'attached letters invalidate the token')
  assert.equal(mapped(initial, [issue()], { from: 4, insert: 'A ' }).issues[0].from, 6)
})

test('ignore rules preserve language and engine scope, with word or rule-level matching', () => {
  const rule = ruleFor(issue())
  assert.equal(ignoredByRule(issue(), [rule]), true)
  assert.equal(ignoredByRule({ ...issue(), language: 'tr' }, [rule]), false)
  assert.equal(ignoredByRule({ ...issue(), original: 'another' }, [rule]), false)
  const grammar = { ...issue(), engine: 'future-engine', type: 'grammar', rule: 'agreement' }
  assert.equal(ignoredByRule({ ...grammar, original: 'different text' }, [ruleFor(grammar)]), true)
})

test('ignore-once maps with its occurrence, survives mode toggles, and does not hide another occurrence', () => {
  let state = EditorState.create({ doc: initial, extensions: [checkIssues] })
  state = state.update({ effects: [enableChecks.of(true), setCheckIssues.of([issue(), { ...issue(28), id: 'two' }])] }).state
  state = state.update({ effects: ignoreCheckIssue.of(issue()) }).state
  assert.equal(state.field(checkIssues).issues.length, 1)
  state = state.update({ changes: { from: 0, insert: 'A ' } }).state
  state = state.update({ effects: enableChecks.of(false) }).state
  state = state.update({ effects: [enableChecks.of(true), setCheckIssues.of([{ ...issue(6), id: 'new-one' }, { ...issue(30), id: 'new-two' }])] }).state
  assert.deepEqual(state.field(checkIssues).issues.map(i => i.id), ['new-two'])
  state = state.update({ changes: { from: 6, to: 15, insert: 'correct' } }).state
  assert.equal(state.field(checkIssues).ignored.length, 0)
})

test('stale panel actions cannot replace a repeated word that moved into the old range', () => {
  let state = EditorState.create({ doc: initial, extensions: [checkIssues] })
  state = state.update({ effects: [enableChecks.of(true), setCheckIssues.of([issue()])] }).state
  state = state.update({ changes: { from: 4, to: 28 } }).state
  let changed = false
  const view = { state, dispatch() { changed = true }, focus() {} }
  assert.equal(state.sliceDoc(4, 13), 'misspelld')
  assert.equal(acceptCheckIssue(view, issue(), 'tickets'), false)
  assert.equal(changed, false)
})
