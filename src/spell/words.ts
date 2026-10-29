export type SpellLanguage = 'en' | 'tr'
export type SpellWord = { from: number; to: number; word: string; stem: string }

// Letters with internal apostrophes: "ticket's", "Derya’nın". Dictionaries use the ASCII apostrophe.
const pattern = /[\p{L}\p{M}]+(?:['’][\p{L}\p{M}]+)*/gu
const glued = /[\p{N}_/@\\:=#]/u
export const normalize = (word: string) => word.normalize('NFC').replaceAll('’', "'")
export const fold = (word: string, language: SpellLanguage) => normalize(word).toLocaleLowerCase(language)

export function spellWords(text: string, offset = 0): SpellWord[] {
  return [...text.matchAll(pattern)].flatMap(match => {
    const word = match[0], start = match.index!, before = text[start - 1] ?? '', after = text[start + word.length] ?? ''
    // Single letters, acronyms and tokens glued to digits, ids or paths are never flagged.
    if (Array.from(word).length < 2 || glued.test(before) || glued.test(after) || word === word.toLocaleUpperCase() && word !== word.toLocaleLowerCase()) return []
    return [{ from: offset + start, to: offset + start + word.length, word: normalize(word), stem: normalize(word).split("'")[0] }]
  })
}

// Words the writer accepted: personal dictionary, this project's ignore list, card names and aliases.
export function acceptedWords(language: SpellLanguage, ...lists: (readonly string[] | undefined)[]) {
  return new Set(lists.flatMap(list => list ?? []).flatMap(text => spellWords(text).map(w => fold(w.word, language)).concat(fold(text.trim(), language))))
}

// verdict: true = correct, false = misspelled, undefined = not checked yet.
export function misspelled(word: SpellWord, language: SpellLanguage, accepted: Set<string>, verdict: (word: string) => boolean | undefined) {
  if (accepted.has(fold(word.word, language)) || accepted.has(fold(word.stem, language))) return false
  if (verdict(word.word) !== false) return false
  // Turkish proper nouns take suffixes after an apostrophe: İstanbul’da, Derya’nın.
  return !(word.stem !== word.word && verdict(word.stem) === true)
}
