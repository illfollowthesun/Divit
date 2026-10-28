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
