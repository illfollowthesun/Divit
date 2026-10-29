import nspell from 'nspell'

type Request = { id: number; language: string; aff: string; dic: string; words?: string[]; suggest?: string }
const checkers = new Map<string, Promise<ReturnType<typeof nspell>>>()

// The Turkish dictionary takes about a second to load, so it lives off the main thread.
function checker(request: Request) {
  let ready = checkers.get(request.language)
  if (!ready) {
    ready = Promise.all([request.aff, request.dic].map(url => fetch(url).then(r => { if (!r.ok) throw new Error('The spelling dictionary could not be loaded.'); return r.text() }))).then(([aff, dic]) => nspell(aff, dic))
    ready.catch(() => checkers.delete(request.language))
    checkers.set(request.language, ready)
  }
  return ready
}
self.onmessage = async (event: MessageEvent<Request>) => {
  const request = event.data
  try {
    const spell = await checker(request)
    const result = request.suggest !== undefined ? spell.suggest(request.suggest).slice(0, 3) : (request.words ?? []).filter(word => !spell.correct(word))
    postMessage({ id: request.id, result })
  } catch (error) { postMessage({ id: request.id, error: error instanceof Error ? error.message : String(error) }) }
}
