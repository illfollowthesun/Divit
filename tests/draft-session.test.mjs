import test from 'node:test'
import assert from 'node:assert/strict'
import { DraftSession, canonicalDraft } from '../src/shared/draft-session.ts'

const draft = () => ({ schemaVersion: 1, id: 'draft-1', type: 'blog', title: 'İstanbul', slug: 'istanbul', body: 'İlk cümle.', date: '2026-10-29', tags: ['şehir'], place: 'İstanbul', excerpt: '', standfirst: '', createdAt: '2026-10-29T10:00:00Z', updatedAt: '2026-10-29T10:00:00Z', revision: 'initial' })
function deferred() { let resolve; const promise = new Promise(yes => { resolve = yes }); return { promise, resolve } }
function events() { return { changes: [], writes: [], failures: [], changed(project, status) { this.changes.push({ project, status }) }, saved(project) { this.writes.push(project) }, failed(error) { this.failures.push(error) } } }

test('a flush saves newer edits made during an in-flight write with the new revision', async () => {
  const started = deferred(); const release = deferred(); const snapshots = []; const observed = events()
  const session = new DraftSession(async project => {
    snapshots.push(structuredClone(project))
    if (snapshots.length === 1) { started.resolve(); await release.promise }
    return { ...project, revision: `saved-${snapshots.length}` }
  }, observed)
  session.select(draft()); session.edit({ body: 'Birinci değişiklik.' })
  const saved = session.flush(); await started.promise
  session.edit({ body: 'Kayıt sürerken eklenen cümle.' }); release.resolve(); await saved
  assert.equal(snapshots.length, 2)
  assert.equal(snapshots[0].revision, 'initial')
  assert.equal(snapshots[1].revision, 'saved-1')
  assert.equal(session.project.body, 'Kayıt sürerken eklenen cümle.')
  assert.equal(session.project.revision, 'saved-2'); assert.equal(session.dirty, false)
  assert.equal(observed.changes.at(-1).status, 'All changes saved')
})

test('failed save retains text and revision, blocks switching, and permits a deliberate retry', async () => {
  let fail = true; const observed = events()
  const session = new DraftSession(async project => { if (fail) throw new Error('Disk full'); return { ...project, revision: 'recovered' } }, observed)
  session.select(draft()); session.edit({ body: 'Kaybolmaması gereken metin.' })
  await assert.rejects(session.flush(), /Disk full/)
  assert.equal(session.project.body, 'Kaybolmaması gereken metin.'); assert.equal(session.project.revision, 'initial')
  assert.equal(session.dirty, true); assert.throws(() => session.select(null), /not been saved/)
  assert.equal(observed.failures.length, 1)
  fail = false; await session.flush()
  assert.equal(session.dirty, false); assert.equal(session.project.revision, 'recovered')
  session.select({ ...draft(), id: 'draft-2' }); assert.equal(session.project.id, 'draft-2')
})

test('backend key order does not cause an endless autosave loop', async () => {
  let calls = 0
  const session = new DraftSession(async project => {
    calls++; assert.ok(calls < 3, 'Autosave must settle')
    return Object.fromEntries(Object.entries({ ...project, revision: 'sorted' }).sort(([a], [b]) => a.localeCompare(b)))
  }, events())
  session.select(draft()); session.edit({ title: 'Yeni başlık' }); await session.flush()
  assert.equal(calls, 1); assert.equal(session.dirty, false)
  assert.equal(canonicalDraft(draft()), canonicalDraft({ ...draft(), revision: 'another' }))
})

test('concurrent flush requests serialize without writing the same revision twice', async () => {
  const release = deferred(); let calls = 0; let active = 0; let maximum = 0
  const session = new DraftSession(async project => {
    calls++; active++; maximum = Math.max(maximum, active)
    await release.promise; active--; return { ...project, revision: 'saved' }
  }, events())
  session.select(draft()); session.edit({ body: 'Bir metin.' })
  const first = session.flush(); const second = session.flush(); release.resolve()
  await Promise.all([first, second]); assert.equal(maximum, 1); assert.equal(calls, 1); assert.equal(session.dirty, false)
})
