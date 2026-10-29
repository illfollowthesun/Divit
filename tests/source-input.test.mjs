import test from 'node:test'
import assert from 'node:assert/strict'
import { asUrl } from '../src/research/source-input.ts'
test('the Sources box fetches only clear web addresses; everything else is a topic', () => {
  assert.equal(asUrl('https://example.com/a?b=1#c'), 'https://example.com/a?b=1#c')
  assert.equal(asUrl('  http://127.0.0.1:4000/karakoy '), 'http://127.0.0.1:4000/karakoy')
  assert.equal(asUrl('example.com'), 'https://example.com/')
  assert.equal(asUrl('www.sehirhatlari.istanbul'), 'https://www.sehirhatlari.istanbul/')
  assert.equal(asUrl('sehirhatlari.istanbul/tr/tarife'), 'https://sehirhatlari.istanbul/tr/tarife')
  assert.equal(asUrl('haber.com.tr'), 'https://haber.com.tr/')
  for (const topic of ['winter ferries', 'Kış vapur tarifesi', 'Node.js', 'e.g.', 'ferry', '', '   ', 'ftp://example.com/file', 'javascript:alert(1)', 'mailto:me@example.com'])
    assert.equal(asUrl(topic), null, topic)
})
