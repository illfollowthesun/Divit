import test from 'node:test'
import assert from 'node:assert/strict'
import { keys } from '../scripts/i18n-keys.mjs'
import { tr } from '../src/i18n/tr.ts'
import { t, tn, setLanguage, resolveLanguage } from '../src/i18n/index.ts'

test('every interface string has a Turkish translation with the same placeholders', () => {
  const missing = keys().filter(k => !(k in tr))
  assert.deepEqual(missing, [], `Add these to src/i18n/tr.ts: ${missing.join(' | ')}`)
  const holes = s => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',')
  for (const [english, turkish] of Object.entries(tr)) assert.equal(holes(turkish), holes(english), `placeholders differ for "${english}"`)
})
test('t() looks up the language, fills placeholders and falls back to English', () => {
  setLanguage('tr')
  assert.equal(t('Save settings'), 'Ayarları kaydet')
  assert.equal(t('{n} min read', { n: 12 }), '12 dk okuma')
  assert.equal(tn(1, '{n} word', '{n} words'), '1 kelime'); assert.equal(tn(12000, '{n} word', '{n} words'), '12.000 kelime')
  assert.equal(t('A sentence no one translated'), 'A sentence no one translated')
  setLanguage('en')
  assert.equal(t('Save settings'), 'Save settings'); assert.equal(tn(2, '{n} word', '{n} words'), '2 words')
  assert.equal(resolveLanguage('tr'), 'tr'); assert.equal(resolveLanguage('en'), 'en')
})
