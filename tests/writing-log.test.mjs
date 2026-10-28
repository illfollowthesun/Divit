import test from 'node:test'
import assert from 'node:assert/strict'
import { recordWriting } from '../src/projects/writing-log.ts'
test('writing log records additions and deletions by local day without discarding earlier days',()=>{
  let project={writingLog:[{date:'2026-10-28',added:100,removed:5}]}
  project.writingLog=recordWriting(project,'','Bir gün daha.','2026-10-29')
  project.writingLog=recordWriting(project,'Bir gün daha.','Bir gün.','2026-10-29')
  assert.deepEqual(project.writingLog,[{date:'2026-10-28',added:100,removed:5},{date:'2026-10-29',added:3,removed:1}])
  assert.equal(recordWriting(project,'Bir gün.','Başka gün.','2026-10-29'),project.writingLog)
})
