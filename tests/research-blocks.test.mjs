import test from 'node:test'
import assert from 'node:assert/strict'
import { textBlocks } from '../src/research/blocks.ts'
test('reader blocks point at exact offsets of the saved text', () => {
  const text = '# Vapurlar\n\nİlk satır\ndevamı.\n\n- bir\n- iki\n> Alıntı burada\n\n```\ncode line\n```\nSon.'
  const blocks = textBlocks(text)
  assert.deepEqual(blocks.map(b => [b.kind, text.slice(b.from, b.to)]), [
    ['h1', 'Vapurlar'], ['p', 'İlk satır\ndevamı.'], ['li', 'bir'], ['li', 'iki'], ['quote', 'Alıntı burada'], ['code', 'code line'], ['p', 'Son.'],
  ])
  assert.deepEqual(textBlocks(''), []); assert.deepEqual(textBlocks('#\n\n- '), [{ kind: 'p', from: 0, to: 1 }])
})
