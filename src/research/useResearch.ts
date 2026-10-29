import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../shared/api'
import type { Research, ResearchSource } from '../shared/types'

const message = (e: unknown) => e instanceof Error ? e.message : String(e)
export const INBOX_POLL_MS = 1000
export type Annotations = Pick<Research, 'highlights' | 'notes' | 'ai'>
type Owned = { projectId: string; research: Research }
type Requests = { load: number; revision: number; pendingWrites: number }

// Loads a project's research and imports files dropped into its inbox while the project is open.
// Research is always tagged with the project it was loaded for, so a switch between projects can
// never show, or save, one project's research into another.
export function useResearch(projectId: string | null, onError: (message: string) => void, paused = false) {
  const [state, setState] = useState<Owned | null>(null)
  const latest = useRef<Owned | null>(null), saving = useRef(Promise.resolve())
  const requests = useRef(new Map<string, Requests>())
  const requestState = useCallback((id: string) => {
    let state = requests.current.get(id)
    if (!state) { state = { load: 0, revision: 0, pendingWrites: 0 }; requests.current.set(id, state) }
    return state
  }, [])
  const store = useCallback((value: Owned | null) => { latest.current = value; setState(value) }, [])
  const failed = useRef(onError); failed.current = onError
  const open = useRef(projectId); open.current = projectId
  const quiet = useRef(paused); quiet.current = paused
  const reload = useCallback(async () => {
    if (!projectId) return null
    const requests = requestState(projectId), load = ++requests.load, revision = requests.revision
    const loaded = await api.research<Research>(projectId, 'load')
    // An older read must not replace a newer read or a saved annotation/AI summary.
    if (open.current === projectId && !quiet.current && load === requests.load && revision === requests.revision && !requests.pendingWrites) store({ projectId, research: loaded })
    return loaded
  }, [projectId, store, requestState])
  // Each change builds on the result of the one before, so quick successive highlights are all kept.
  const saveAnnotations = useCallback((change: (current: Annotations) => Partial<Annotations>) => {
    if (!projectId) return Promise.reject(new Error('Choose a project first.'))
    const requests = requestState(projectId)
    requests.revision++; requests.pendingWrites++
    const run = saving.current.then(async () => {
      const owned = latest.current
      if (!projectId || !owned || owned.projectId !== projectId) throw new Error('This research is still loading. Try again in a moment.')
      const { highlights, notes, ai } = owned.research
      const saved = await api.research<Research>(projectId, 'save-annotations', { highlights, notes, ai, ...change({ highlights, notes, ai }) })
      if (open.current === projectId) store({ projectId, research: saved })
    }).finally(() => { requests.pendingWrites--; requests.revision++ })
    saving.current = run.catch(() => {})
    return run
  }, [projectId, store, requestState])
  useEffect(() => {
    store(null)
    if (!projectId || paused) return
    let active = true, running = false
    void reload().catch(error => { if (active && !quiet.current) failed.current(message(error)) })
    const poll = async () => {
      if (running || document.visibilityState !== 'visible') return
      running = true
      try {
        if (await api.research<number>(projectId, 'pending') > 0) {
          const result = await api.research<{ imported: ResearchSource[] }>(projectId, 'scan-inbox')
          if (active && !quiet.current && result.imported.length) await reload()
        }
      } catch (error) { if (active && !quiet.current) { failed.current(message(error)); clearInterval(timer) } } finally { running = false }
    }
    const timer = window.setInterval(() => { void poll() }, INBOX_POLL_MS)
    return () => { active = false; clearInterval(timer) }
  }, [projectId, reload, store, paused])
  const research = state && state.projectId === projectId ? state.research : null
  return { research, reload, saveAnnotations }
}
