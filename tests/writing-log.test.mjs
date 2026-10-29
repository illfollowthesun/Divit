import test from 'node:test'
import assert from 'node:assert/strict'
import { recordWriting, streak, wordsOn } from '../src/projects/writing-log.ts'
test('writing log records additions and deletions by local day without discarding earlier days',()=>{
  let project={writingLog:[{date:'2026-10-28',added:100,removed:5}]}
  project.writingLog=recordWriting(project,'','Bir gün daha.','2026-10-29')
  project.writingLog=recordWriting(project,'Bir gün daha.','Bir gün.','2026-10-29')
  assert.deepEqual(project.writingLog,[{date:'2026-10-28',added:100,removed:5},{date:'2026-10-29',added:3,removed:1}])
  assert.equal(recordWriting(project,'Bir gün.','Başka gün.','2026-10-29'),project.writingLog)
})
test('the daily goal counts net words across projects; the streak counts days with writing', () => {
  const a = { writingLog: [{ date: '2026-10-27', added: 50, removed: 0 }, { date: '2026-10-29', added: 10, removed: 2 }, { date: '2026-10-30', added: 120, removed: 20 }] }
  const b = { writingLog: [{ date: '2026-10-28', added: 5, removed: 0 }, { date: '2026-10-30', added: 0, removed: 400 }] }
  assert.equal(wordsOn([a], '2026-10-30'), 100); assert.equal(wordsOn([a, b], '2026-10-30'), 0, 'never below zero'); assert.equal(wordsOn([a, b], '2026-10-01'), 0)
  assert.equal(streak([a, b], '2026-10-30'), 4)
  assert.equal(streak([a, b], '2026-10-31'), 4, 'an empty today keeps yesterday’s streak')
  assert.equal(streak([a, b], '2026-11-01'), 0)
  assert.equal(streak([b], '2026-10-30'), 0, 'deleting only is not writing'); assert.equal(streak([], '2026-10-30'), 0)
})
