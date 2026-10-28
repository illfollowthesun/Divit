import test from 'node:test'
import assert from 'node:assert/strict'
import { sectionWords } from '../src/projects/outline-summary.ts'
test('chapter counts include active scenes and exclude set-aside writing',()=>{
  const p={sections:[{id:'c',kind:'chapter',body:'Bir gün'},{id:'s',parentId:'c',kind:'scene',body:'Vapur kalktı.'},{id:'x',parentId:'c',kind:'scene',body:'Count none of these words.',trashedAt:'today'}]}
  assert.equal(sectionWords(p,'c'),4);assert.equal(sectionWords(p,'s'),2);assert.equal(sectionWords(p,'x'),0)
})
