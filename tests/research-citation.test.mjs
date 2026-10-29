import test from 'node:test'
import assert from 'node:assert/strict'
import { citation, quoteBlock, footnote, nextFootnote, wordCount } from '../src/research/citation.ts'
const source = { title: 'Karaköy iskelesi', site: 'Şehir Hatları', published: '2026-10-20', saved: '2026-10-29', url: 'https://example.com/k' }
test('every quote format carries title, site, date and URL', () => {
  assert.equal(citation(source), 'Karaköy iskelesi, Şehir Hatları (2026-10-20), https://example.com/k')
  assert.equal(citation({ title: 'Notes', saved: '2026-10-29' }), 'Notes (2026-10-29)')
  assert.equal(quoteBlock('İlk vapur 06:10.\nMartılar geldi.', source), '> İlk vapur 06:10.\n> Martılar geldi.\n>\n> — Karaköy iskelesi, Şehir Hatları (2026-10-20), https://example.com/k')
  assert.deepEqual(footnote('İlk\nvapur', source, 3), { inline: '“İlk vapur”[^3]', note: '[^3]: Karaköy iskelesi, Şehir Hatları (2026-10-20), https://example.com/k' })
})
test('footnote numbers continue after existing ones; long quotes are counted in words', () => {
  assert.equal(nextFootnote('No notes yet.'), 1)
  assert.equal(nextFootnote('Text[^1] and[^4].\n\n[^1]: A\n[^4]: B\nnot a [^9]: definition'), 5)
  assert.equal(wordCount('  bir iki\nüç  '), 3); assert.equal(wordCount(''), 0)
})
