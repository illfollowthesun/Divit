import { tr } from './tr.ts'

// Interface language (menus, buttons, messages). The language of the writing itself is a separate,
// per-project choice. Strings are written in English at the call site and looked up by that text;
// a missing translation falls back to English. tests/i18n.test.mjs checks every t('…') has a Turkish entry.
export type UiLanguage = 'en' | 'tr'
export type UiLanguageSetting = UiLanguage | 'system'
const dictionaries: Record<UiLanguage, Record<string, string>> = { en: {}, tr }
let current: UiLanguage = 'en'

export function systemLanguage(): UiLanguage {
  const preferred = typeof navigator === 'undefined' ? [] : navigator.languages?.length ? navigator.languages : [navigator.language]
  return /^tr\b/i.test(preferred[0] ?? '') ? 'tr' : 'en'
}
export const resolveLanguage = (setting: UiLanguageSetting | undefined): UiLanguage => !setting || setting === 'system' ? systemLanguage() : setting
export function setLanguage(language: UiLanguage) {
  current = language
  if (typeof document !== 'undefined') document.documentElement.lang = language
}
export const language = () => current

// t('Saved {n} sources', { n: 3 }). Placeholders are {name}; numbers are formatted for the language.
export function t(text: string, values?: Record<string, string | number>): string {
  const template = dictionaries[current][text] ?? text
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (whole, name: string) => {
    const value = values[name]
    return value === undefined ? whole : typeof value === 'number' ? value.toLocaleString(current === 'tr' ? 'tr-TR' : 'en-GB') : value
  })
}
// Picks the singular or plural English text; Turkish uses one form after numbers.
export const tn = (n: number, one: string, many: string, values: Record<string, string | number> = {}) => t(n === 1 ? one : many, { n, ...values })
