// Colour themes, all on the same CSS tokens. Every theme keeps text, muted text, links, buttons and
// spelling underlines at WCAG AA contrast; tests/themes.test.mjs checks each pair.
export type ThemeId = 'light' | 'dark' | 'sage' | 'blue' | 'terracotta' | 'plum'
export type ThemeSetting = ThemeId | 'system'
export type Tokens = { paper: string; bg: string; chrome: string; text: string; muted: string; line: string; accent: string; hover: string; card: string; error: string; underline: string; ok: string; shadow: string }
export type Theme = { id: ThemeId; name: string; tone: 'light' | 'dark'; tokens: Tokens }

const lightShadow = '0 15px 70px #2b251c22', darkShadow = '0 15px 70px #0006'
export const themes: Theme[] = [
  { id: 'light', name: 'Warm paper', tone: 'light', tokens: { paper: '#f9f6ef', bg: '#f5f1e9', chrome: '#eeebe2', text: '#373a34', muted: '#696a60', line: '#ddd9ce', accent: '#8c4228', hover: '#e7e2d7', card: '#fcfaf5', error: '#8f2e26', underline: '#c0533f', ok: '#4f6040', shadow: lightShadow } },
  { id: 'sage', name: 'Sage paper', tone: 'light', tokens: { paper: '#f3f6ef', bg: '#edf1e7', chrome: '#e4eadc', text: '#2e3a2d', muted: '#56634f', line: '#cfd9c5', accent: '#3d6647', hover: '#dce5d2', card: '#f8faf5', error: '#8f2e26', underline: '#b04a3a', ok: '#3d6647', shadow: lightShadow } },
  { id: 'blue', name: 'Dusty blue ink', tone: 'light', tokens: { paper: '#eef3f9', bg: '#e8eef6', chrome: '#dee6f0', text: '#2a3341', muted: '#535f70', line: '#cdd5e0', accent: '#36547d', hover: '#d8e1ec', card: '#f6f9fc', error: '#8f2e26', underline: '#b4473a', ok: '#486640', shadow: lightShadow } },
  { id: 'dark', name: 'After hours', tone: 'dark', tokens: { paper: '#252620', bg: '#20231c', chrome: '#1c1f18', text: '#dedbd0', muted: '#a8a89a', line: '#3e4035', accent: '#d89472', hover: '#34362c', card: '#2b2d25', error: '#f0a099', underline: '#e48b78', ok: '#a9c196', shadow: darkShadow } },
  { id: 'terracotta', name: 'Terracotta evening', tone: 'dark', tokens: { paper: '#2b211d', bg: '#251c19', chrome: '#211916', text: '#eedfd2', muted: '#bba497', line: '#4a3a32', accent: '#e8a07b', hover: '#3a2c26', card: '#322621', error: '#f4a69a', underline: '#f0907b', ok: '#b0c995', shadow: darkShadow } },
  { id: 'plum', name: 'Plum night', tone: 'dark', tokens: { paper: '#241e2b', bg: '#1f1a25', chrome: '#1b1620', text: '#e6deec', muted: '#b0a2bd', line: '#403649', accent: '#cfa6e6', hover: '#322a3b', card: '#2a2332', error: '#f4a6a6', underline: '#f2939c', ok: '#abc99d', shadow: darkShadow } },
]
// Highlight tints in the research reader, one set per tone (see research.css).
export const highlightTints = { light: ['#efe2b8', '#d8e3cf', '#d5e1ea', '#edd8d2'], dark: ['#5a5032', '#3d4b38', '#34444f', '#553c37'] }

export function resolveTheme(setting: ThemeSetting | undefined, systemDark: boolean): Theme {
  const id = !setting || setting === 'system' ? systemDark ? 'dark' : 'light' : setting
  return themes.find(theme => theme.id === id) ?? themes[0]
}
export function applyTheme(theme: Theme, root: HTMLElement = document.documentElement) {
  root.dataset.theme = theme.id; root.dataset.tone = theme.tone; root.style.colorScheme = theme.tone
  for (const [name, value] of Object.entries(theme.tokens)) root.style.setProperty(`--${name}`, value)
}

// WCAG relative luminance and contrast ratio for #rgb / #rrggbb colours.
const channel = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4 }
export function luminance(hex: string) {
  const h = hex.replace('#', ''), full = h.length === 3 ? [...h].map(c => c + c).join('') : h.slice(0, 6)
  const [r, g, b] = [0, 2, 4].map(i => parseInt(full.slice(i, i + 2), 16))
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}
export function contrast(a: string, b: string) { const [x, y] = [luminance(a), luminance(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05) }
