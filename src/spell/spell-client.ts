/// <reference types="vite/client" />
// The dictionary packages only export a Node entry point, so their files are referenced directly.
import enAff from '../../node_modules/dictionary-en-gb/index.aff?url'
import enDic from '../../node_modules/dictionary-en-gb/index.dic?url'
import trAff from '../../node_modules/dictionary-tr/index.aff?url'
import trDic from '../../node_modules/dictionary-tr/index.dic?url'
import type { SpellLanguage } from './words'

const files = { en: { aff: enAff, dic: enDic }, tr: { aff: trAff, dic: trDic } }
const verdicts = { en: new Map<string, boolean>(), tr: new Map<string, boolean>() }
const suggested = { en: new Map<string, Promise<string[]>>(), tr: new Map<string, Promise<string[]>>() }
const pending = new Map<number, { resolve: (value: never) => void; reject: (error: Error) => void }>()
let worker: Worker | null = null, nextId = 0

function call<T>(language: SpellLanguage, request: { words?: string[]; suggest?: string }): Promise<T> {
  if (!worker) {
    worker = new Worker(new URL('./spell-worker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (event: MessageEvent<{ id: number; result?: never; error?: string }>) => {
      const waiting = pending.get(event.data.id); pending.delete(event.data.id)
      if (event.data.error) waiting?.reject(new Error(event.data.error)); else waiting?.resolve(event.data.result!)
    }
  }
  const id = nextId++
  return new Promise<T>((resolve, reject) => { pending.set(id, { resolve: resolve as (value: never) => void, reject }); worker!.postMessage({ id, language, ...files[language], ...request }) })
}
export const verdict = (language: SpellLanguage, word: string) => verdicts[language].get(word)

// Serialize per language so overlapping scans wait for shared words instead of missing verdicts.
const queues = { en: Promise.resolve(false), tr: Promise.resolve(false) }
export async function checkWords(language: SpellLanguage, words: string[]) {
  const result = queues[language].catch(() => false).then(async () => {
    const fresh = [...new Set(words)].filter(word => !verdicts[language].has(word))
    if (!fresh.length) return false
    const wrong = new Set(await call<string[]>(language, { words: fresh }))
    for (const word of fresh) verdicts[language].set(word, !wrong.has(word))
    return true
  })
  queues[language] = result
  return result
}
export function suggestions(language: SpellLanguage, word: string) {
  let found = suggested[language].get(word)
  if (!found) { found = call<string[]>(language, { suggest: word }); found.catch(() => suggested[language].delete(word)); suggested[language].set(word, found) }
  return found
}
