import test from 'node:test'
import assert from 'node:assert/strict'
import { themes, highlightTints, contrast, resolveTheme } from '../src/themes.ts'

test('every theme meets WCAG AA for text, muted text, links, buttons and underlines', () => {
  const failures = []
  const need = (theme, label, fg, bg, min) => { const ratio = contrast(fg, bg); if (ratio < min) failures.push(`${theme.id}: ${label} ${ratio.toFixed(2)} < ${min}`) }
  for (const theme of themes) {
    const k = theme.tokens
    for (const surface of ['paper', 'bg', 'chrome', 'card']) {
      need(theme, `text on ${surface}`, k.text, k[surface], 4.5)
      need(theme, `muted on ${surface}`, k.muted, k[surface], 4.5)
    }
    need(theme, 'accent on paper', k.accent, k.paper, 4.5); need(theme, 'accent on chrome', k.accent, k.chrome, 4.5)
    need(theme, 'button text on accent', k.paper, k.accent, 4.5)
    need(theme, 'error on paper', k.error, k.paper, 4.5); need(theme, 'ok on paper', k.ok, k.paper, 4.5); need(theme, 'ok on card', k.ok, k.card, 4.5)
    need(theme, 'spelling underline on paper', k.underline, k.paper, 3)
    need(theme, 'text on hover', k.text, k.hover, 4.5)
    for (const tint of highlightTints[theme.tone]) need(theme, `text on highlight ${tint}`, k.text, tint, 4.5)
  }
  assert.deepEqual(failures, [])
})
test('themes are calm and coloured: no plain black, white or grey, each with its own accent', () => {
  const grey = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16)); return Math.max(r, g, b) - Math.min(r, g, b) < 6 }
  for (const theme of themes) for (const name of ['paper', 'bg', 'text', 'accent']) assert.equal(grey(theme.tokens[name]), false, `${theme.id} ${name} is plain grey`)
  assert.equal(new Set(themes.map(t => t.tokens.accent)).size, themes.length)
  assert.ok(themes.length >= 6)
  assert.equal(resolveTheme('system', true).id, 'dark'); assert.equal(resolveTheme('system', false).id, 'light'); assert.equal(resolveTheme('plum', false).id, 'plum'); assert.equal(resolveTheme(undefined, true).id, 'dark')
})
