import test from 'node:test'
import assert from 'node:assert/strict'
import { orderedSections, addSection, moveSection, dropSection, archiveSection, restoreSection, manuscriptText } from '../src/projects/manuscript.ts'
const book = () => ({ type: 'book', title: 'City', body: 'Opening.', sections: [{id:'c1',kind:'chapter',title:'One',body:'First.'},{id:'s1',kind:'scene',parentId:'c1',title:'Dock',body:'At dawn.'},{id:'c2',kind:'chapter',title:'Two',body:'Second.'},{id:'s2',kind:'scene',parentId:'c2',title:'Home',body:'At night.'}] })
test('chapter reorder carries its scenes into reading order and export', () => {
  const project = book(); project.sections = moveSection(project,'c2',-1)
  assert.deepEqual(orderedSections(project).map(n=>n.id),['c2','s2','c1','s1'])
  assert.ok(manuscriptText(project).indexOf('# Two') < manuscriptText(project).indexOf('# One'))
})
test('scene drag moves between chapters without losing text', () => {
  const project=book();project.sections=dropSection(project,'s1','c2')
  assert.equal(project.sections.find(n=>n.id==='s1').parentId,'c2')
  assert.equal(project.sections.find(n=>n.id==='s1').body,'At dawn.')
})
test('setting aside a chapter preserves descendants and restores all writing', () => {
  const project=book();project.sections=archiveSection(project,'c1')
  assert.deepEqual(orderedSections(project).map(n=>n.id),['c2','s2'])
  assert.equal(project.sections.find(n=>n.id==='s1').body,'At dawn.')
  project.sections=restoreSection(project,'s1');assert.equal(orderedSections(project).length,4)
})
test('books require a chapter for scenes; stories keep root scenes; blog rejects chapters', () => {
  assert.throws(()=>addSection({type:'book',sections:[]},'scene',null),/chapter/)
  assert.throws(()=>addSection({type:'blog'},'chapter',null))
  const result=addSection({type:'story',sections:[]},'scene',null);assert.equal(result.sections[0].parentId,undefined)
})
