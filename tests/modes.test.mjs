import test from 'node:test'
import assert from 'node:assert/strict'
import { startMode, underlinesShown, shortcutMode } from '../src/modes/mode.ts'
import { DraftSession } from '../src/shared/draft-session.ts'

test('mode fallback and explicit Normal underline opt-in', () => {
  assert.equal(startMode(null, {}), 'normal')
  assert.equal(startMode({}, { lastMode: 'write' }), 'write')
  assert.equal(startMode({ mode: 'review' }, { lastMode: 'write' }), 'review')
  assert.equal(underlinesShown('normal', {}), false)
  assert.equal(underlinesShown('normal', { underlines: true }), true)
  assert.equal(underlinesShown('write', { underlines: true }), false)
  assert.equal(underlinesShown('review', {}), true)
  assert.equal(shortcutMode({ ctrlKey: true, code: 'Digit1' }), 'write')
  assert.equal(shortcutMode({ ctrlKey: true, altKey: true, code: 'Digit1' }), null)
})

test('mode saves preserve writing timestamp and participate in the save queue', async () => {
  const writes = []
  const session = new DraftSession(async project => { writes.push(project); return { ...project, revision: 'saved' } }, { changed() {}, saved() {}, failed() {} })
  session.select({ id: 'mode-test', body: 'Text', updatedAt: 'original' })
  session.edit({ mode: 'write' }, false)
  assert.equal(session.dirty, true)
  await session.flush()
  assert.equal(writes[0].updatedAt, 'original')
  assert.equal(session.project.mode, 'write')
  assert.equal(session.dirty, false)
})
