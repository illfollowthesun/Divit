import test from 'node:test'
import assert from 'node:assert/strict'
import { takeSnapshot, restoreSnapshot, snapshotText } from '../src/projects/snapshots.ts'
const project=()=>({title:'Ferry',body:'Opening',type:'book',sections:[{id:'c',kind:'chapter',title:'Departure',body:'Old chapter'},{id:'s',kind:'scene',parentId:'c',title:'Deck',body:'Old scene'},{id:'other',kind:'chapter',title:'Arrival',body:'Keep this'}],snapshots:[]})
test('chapter snapshots are immutable copies and include their scenes',()=>{
  const p=project(),snapshot=takeSnapshot(p,'c','Before rewrite');p.sections[1].body='Changed'
  assert.equal(snapshot.sections[1].body,'Old scene');assert.ok(snapshotText(snapshot).includes('Old scene'))
})
test('restoring a chapter preserves current writing as a safeguard and sets new scenes aside',()=>{
  const p=project(),snapshot=takeSnapshot(p,'c','First version');p.snapshots.push(snapshot)
  p.sections[0].body='New chapter';p.sections.push({id:'new',kind:'scene',parentId:'c',title:'New',body:'Do not lose this'})
  const restored=restoreSnapshot(p,snapshot)
  assert.equal(restored.sections.find(n=>n.id==='c').body,'Old chapter')
  assert.equal(restored.sections.find(n=>n.id==='other').body,'Keep this')
  assert.ok(restored.sections.find(n=>n.id==='new').trashedAt)
  assert.equal(restored.sections.find(n=>n.id==='new').body,'Do not lose this')
  assert.equal(restored.snapshots.length,2);assert.equal(restored.snapshots[1].body,'New chapter')
})
test('restoring a whole manuscript recovers text and order without deleting later additions',()=>{
  const p=project(),snapshot=takeSnapshot(p,null,'Original');p.body='New opening';p.sections.push({id:'extra',kind:'chapter',title:'Extra',body:'Retain me'})
  const restored=restoreSnapshot(p,snapshot);assert.equal(restored.body,'Opening');assert.ok(restored.sections.find(n=>n.id==='extra').trashedAt)
  assert.equal(restored.snapshots[0].body,'New opening')
})
test('restoring a chapter does not revive scenes that were already set aside in that version',()=>{
  const p=project();p.sections[1].trashedAt='2026-10-29';const snapshot=takeSnapshot(p,'c','Kept without that scene')
  p.sections[0].body='Rewritten';const restored=restoreSnapshot(p,snapshot)
  assert.equal(restored.sections.find(n=>n.id==='s').trashedAt,'2026-10-29')
  assert.equal(restored.sections.find(n=>n.id==='s').body,'Old scene')
})
