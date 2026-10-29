import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import nspell from 'nspell'
import { spellWords, acceptedWords, misspelled } from '../src/spell/words.ts'
const dictionary = name => nspell(readFileSync(`node_modules/dictionary-${name}/index.aff`), readFileSync(`node_modules/dictionary-${name}/index.dic`))
test('words keep apostrophes and skip ids, acronyms and single letters', () => {
  const text = 'Derya’nın ticket\'s USB a ![x](yazi-image:ab12) word2 İstanbul'
  assert.deepEqual(spellWords(text).map(w => w.word), ["Derya'nın", "ticket's", 'yazi', 'İstanbul'])
  assert.equal(spellWords(text)[0].stem, 'Derya')
  const at = spellWords('  çağla', 10)[0]; assert.deepEqual([at.from, at.to], [12, 17])
})
test('personal words, ignored words and card names are never flagged, in Turkish case rules too', () => {
  const accepted = acceptedWords('tr', ['Karaköy'], ['vapurcu'], ['İlker Bey'])
  const wrong = () => false
  for (const word of ['karaköy', 'Vapurcu', 'ilker', "İlker'in"]) assert.equal(misspelled(spellWords(word)[0], 'tr', accepted, wrong), false, word)
  assert.equal(misspelled(spellWords('yazıyorr')[0], 'tr', accepted, wrong), true)
  assert.equal(misspelled(spellWords('anything')[0], 'tr', accepted, () => undefined), false, 'unchecked words wait')
})
test('the bundled en-GB and Turkish dictionaries recognise inflected words and suggest corrections', () => {
  const en = dictionary('en-gb')
  for (const word of ['colour', 'recognised', 'tickets']) assert.equal(en.correct(word), true, word)
  assert.equal(en.correct('ticekts'), false); assert.ok(en.suggest('ticekts').includes('tickets'))
  const tr = dictionary('tr')
  for (const word of ['kitaplarımızdan', 'gidiyorduk', 'bekliyordu', 'İstanbul']) assert.equal(tr.correct(word), true, word)
  assert.equal(tr.correct('yazıyorr'), false); assert.ok(tr.suggest('yazıyorr').includes('yazıyor'))
  const proper = spellWords('İstanbul’da')[0]
  assert.equal(misspelled(proper, 'tr', new Set(), word => tr.correct(word)), false)
})
