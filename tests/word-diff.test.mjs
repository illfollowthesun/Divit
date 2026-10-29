import test from 'node:test'
import assert from 'node:assert/strict'
import {wordDiff}from'../src/projects/word-diff.ts'
function check(a,b){const changes=wordDiff(a,b);assert.equal(changes.filter(c=>c.kind!=='added').map(c=>c.text).join(''),a);assert.equal(changes.filter(c=>c.kind!=='removed').map(c=>c.text).join(''),b);return changes}
test('word changes retain common Turkish words and exact punctuation',()=>{
  const changes=check('Çağla eski defteri açtı.','Çağla yeni defteri açtı.')
  assert.equal(changes.filter(c=>c.kind==='removed').map(c=>c.text).join(''),'eski')
  assert.equal(changes.filter(c=>c.kind==='added').map(c=>c.text).join(''),'yeni')
})
test('empty, identical, repeated and multiline text round-trip exactly',()=>{
  for(const [a,b]of[['',''],['','İlk satır'],['Son satır',''],['same','same'],['a b a b','b a b a'],['one\n\ntwo','one\n\nthree'],['a ! b','a ? c']])check(a,b)
  const values=['a','b','ç',' ','\n','.'];let seed=5;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return values[seed%values.length]};for(let i=0;i<100;i++)check(Array.from({length:25},random).join(''),Array.from({length:25},random).join(''))
})
test('large unchanged passages retain word-level detail around a small change',()=>{
  const prefix='A quiet morning. '.repeat(5000),suffix=' A return. '.repeat(5000)
  const changes=check(prefix+'old'+suffix,prefix+'new'+suffix)
  assert.equal(changes.filter(c=>c.kind==='removed').map(c=>c.text).join(''),'old')
})
test('a rewritten sentence reads as one change, not confetti, and paragraph breaks stay',()=>{
  const changes=check('Every morning, the city offered Derya the same small bargain.\n\nKept.','At six in the morning, the city belonged to the people.\n\nKept.')
  assert.ok(changes.filter(c=>c.kind==='removed').length<=2,JSON.stringify(changes))
  assert.ok(changes.every(c=>c.kind==='equal'||!c.text.includes('\n\nKept')))
  assert.equal(changes[changes.length-1].kind,'equal')
})
test('many small edits across a long chapter keep word-level detail',()=>{
  const para=(i,w)=>`Paragraph ${i} keeps an ${w} word in place.`
  const before=Array.from({length:600},(_,i)=>para(i,'old')).join('\n'),after=Array.from({length:600},(_,i)=>para(i,'new')).join('\n')
  const started=performance.now(),changes=check(before,after)
  assert.deepEqual([...new Set(changes.filter(c=>c.kind==='removed').map(c=>c.text))],['old'])
  assert.equal(changes.filter(c=>c.kind==='removed').length,600)
  assert.ok(performance.now()-started<2000)
})
