import { fold, misspelled, spellWords } from '../spell/words.ts'
import type { SpellLanguage } from '../spell/words.ts'

export type CheckLanguage = SpellLanguage | 'auto'
export type Issue = { id: string; from: number; to: number; original: string; language: SpellLanguage; type: 'spelling' | 'grammar' | 'style'; message: string; engine: string; rule: string }
export type CheckInput = { text: string; language: CheckLanguage; accepted: (language: SpellLanguage) => Set<string>; prose?: (from: number, to: number) => boolean }
export interface Checker {
  id: string
  capabilities: { languages: readonly SpellLanguage[]; spelling: boolean; grammar: boolean; style: boolean; network: boolean }
  check(input: CheckInput): Promise<Issue[]>
  suggest(issue: Issue): Promise<string[]>
}

// Short or ambiguous paragraphs fall back to English; the document override is authoritative.
export function paragraphLanguage(text: string): SpellLanguage {
  const words = spellWords(text).map(w => fold(w.word, 'tr'))
  const turkish = new Set(['bir', 'bu', 've', 'ile', 'için', 'ama', 'değil', 'çok', 'ben', 'sen', 'o', 'da', 'de', 'mi'])
  const english = new Set(['the', 'a', 'an', 'and', 'with', 'for', 'but', 'is', 'are', 'this', 'that', 'was', 'were', 'of', 'to'])
  const tr = words.filter(w => turkish.has(w)).length + (/[çğıöşüİ]/u.test(text) ? 2 : 0)
  const en = words.filter(w => english.has(w)).length
  return tr > en ? 'tr' : 'en'
}

type Speller = { checkWords: (language: SpellLanguage, words: string[]) => Promise<unknown>; verdict: (language: SpellLanguage, word: string) => boolean | undefined; suggestions: (language: SpellLanguage, word: string) => Promise<string[]> }

export function hunspellChecker(speller: Speller): Checker {
  return {
    id: 'hunspell',
    capabilities: { languages: ['en', 'tr'], spelling: true, grammar: false, style: false, network: false },
    async check(input) {
      const candidates = [...input.text.matchAll(/[^\n]+(?:\n(?!\s*\n)[^\n]+)*/g)].flatMap(paragraph => {
        const language = input.language === 'auto' ? paragraphLanguage(paragraph[0]) : input.language
        return spellWords(paragraph[0], paragraph.index).filter(word => input.prose?.(word.from, word.to) !== false).map(word => ({ word, language }))
      })
      await Promise.all((['en', 'tr'] as const).map(language => speller.checkWords(language, candidates.filter(c => c.language === language).flatMap(c => [...new Set([c.word.word, c.word.stem])]))))
      return candidates.filter(({ word, language }) => misspelled(word, language, input.accepted(language), word => speller.verdict(language, word))).map(({ word, language }) => ({
        id: `hunspell:${language}:${word.from}:${word.to}`, from: word.from, to: word.to, original: input.text.slice(word.from, word.to), language, type: 'spelling', message: `Check spelling: ${word.word}`, engine: 'hunspell', rule: 'unknown-word',
      }))
    },
    suggest: issue => speller.suggestions(issue.language, issue.original),
  }
}
