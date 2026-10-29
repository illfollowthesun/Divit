import test from 'node:test'
import assert from 'node:assert/strict'
import { hunspellChecker, paragraphLanguage } from '../src/modes/checker.ts'

test('local checker covers the whole text, resolves paragraph languages and honours prose exclusions', async () => {
  const calls = []
  const checker = hunspellChecker({ checkWords: async (language, words) => calls.push({ language, words }), verdict: (_language, word) => !['misspelld', 'yazıyorr', 'tailerror'].includes(word), suggestions: async () => ['replacement'] })
  const text = 'The misspelld word.\n\nTürkçe bir yazıyorr.\n\n' + 'A correct paragraph.\n\n'.repeat(200) + 'tailerror `misspelld`'
  const issues = await checker.check({ text, language: 'auto', accepted: () => new Set(), prose: from => from < text.lastIndexOf('`') - 'misspelld'.length })
  assert.deepEqual(issues.map(i => [i.original, i.language]), [['misspelld', 'en'], ['yazıyorr', 'tr'], ['tailerror', 'en']])
  assert.equal(issues[2].from, text.indexOf('tailerror'))
  assert.equal(checker.capabilities.network, false)
  assert.equal(checker.capabilities.grammar, false)
  assert.equal(paragraphLanguage('Türkçe bir cümle.'), 'tr')
  assert.ok(calls.find(c => c.language === 'tr').words.includes('yazıyorr'))
  const forced = await checker.check({ text: 'Türkçe yazıyorr', language: 'en', accepted: () => new Set(['yazıyorr']) })
  assert.equal(forced.length, 0)
})
