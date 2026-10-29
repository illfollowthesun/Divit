import test from 'node:test'
import assert from 'node:assert/strict'
import { anchor, segments, overlaps } from '../src/research/anchor.ts'
const h = (from, to, quote, id = 'h') => ({ id, sourceId: 's', from, to, quote, color: 1, createdAt: '' })
test('highlights keep offsets, follow their quote after edits and are marked lost, never dropped', () => {
  const text = 'İlk vapur 06:10. Son vapur 23:30.'
  assert.deepEqual(anchor(text, h(4, 9, 'vapur')), h(4, 9, 'vapur'))
  const edited = 'Kışın ilk vapur 06:10. Son vapur 23:30.'
  assert.deepEqual([anchor(edited, h(4, 9, 'vapur')).from, anchor(edited, h(4, 9, 'vapur')).to], [10, 15])
  assert.equal(anchor(edited, h(21, 26, 'vapur')).from, 27, 'the nearest occurrence wins')
  assert.equal(anchor('Başka bir metin.', h(4, 9, 'vapur')).lost, true)
})
test('segments split a block around highlights; overlaps are detected', () => {
  const hs = [h(6, 10, 'cd', 'b'), h(2, 4, 'ab', 'a'), { ...h(0, 1, 'x', 'gone'), lost: true }]
  assert.deepEqual(segments(0, 12, hs).map(s => [s.from, s.to, s.highlight?.id]), [[0, 2, undefined], [2, 4, 'a'], [4, 6, undefined], [6, 10, 'b'], [10, 12, undefined]])
  assert.deepEqual(segments(3, 8, hs).map(s => [s.from, s.to, s.highlight?.id]), [[3, 4, 'a'], [4, 6, undefined], [6, 8, 'b']])
  assert.deepEqual(segments(0, 0, hs), [])
  assert.equal(overlaps(3, 5, hs), true); assert.equal(overlaps(4, 6, hs), false); assert.equal(overlaps(0, 1, hs), false)
})
