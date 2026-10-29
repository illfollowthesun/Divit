import test from 'node:test'
import assert from 'node:assert/strict'
import { documentBlocks } from '../src/projects/document-blocks.ts'
test('Markdown becomes simple blocks for the built-in Word and PDF exporters', () => {
  const blocks = documentBlocks('# Bir\n\nŞehir **uyanıyor** ve *martılar* `06:10`[^1].\n\n> Alıntı\n>\n> — Kaynak\n\n- bir\n- iki\n\n![Vapur](data:image/png;base64,AAAA)\n\n---\n\n[^1]: Şehir Hatları, 2026.')
  assert.deepEqual(blocks[0], { kind: 'heading', level: 1, runs: [{ text: 'Bir' }] })
  assert.deepEqual(blocks[1], { kind: 'paragraph', runs: [{ text: 'Şehir ' }, { text: 'uyanıyor', bold: true }, { text: ' ve ' }, { text: 'martılar', italic: true }, { text: ' ' }, { text: '06:10', code: true }, { text: '1', sup: true }, { text: '.' }] })
  assert.equal(blocks[2].kind, 'quote'); assert.equal(blocks[2].blocks.length, 2)
  assert.deepEqual(blocks[3], { kind: 'list', ordered: false, start: 1, items: [[{ text: 'bir' }], [{ text: 'iki' }]] })
  assert.deepEqual(blocks[4], { kind: 'image', src: 'data:image/png;base64,AAAA', alt: 'Vapur' })
  assert.deepEqual(blocks.slice(-3).map(b => b.kind), ['rule', 'heading', 'paragraph'])
  assert.deepEqual(blocks.at(-1).runs, [{ text: '1', sup: true }, { text: ' ' }, { text: 'Şehir Hatları, 2026.' }])
  assert.equal(JSON.stringify(blocks).includes('[^1]:'), false)
})
