import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../shared/api'
import type { Research, ResearchSource } from '../shared/types'

const message = (e: unknown) => e instanceof Error ? e.message : String(e)
export const INBOX_POLL_MS = 1000
export type Annotations = Pick<Research, 'highlights' | 'notes' | 'ai'>

// Loads a project's research and imports files dropped into its inbox while the project is open.
export function useResearch(projectId: string | null, onError: (message: string) => void) {
  const [research, setState] = useState<Research | null>(null)
  const latest = useRef<Research | null>(null), saving = useRef(Promise.resolve())
  const setResearch = useCallback((value: Research | null) => { latest.current = value; setState(value) }, [])
  const failed = useRef(onError); failed.current = onError
  const reload = useCallback(async () => {
    if (!projectId) return null
    const loaded = await api.research<Research>(projectId, 'load'); setResearch(loaded); return loaded
  }, [projectId, setResearch])
  // Each change builds on the result of the one before, so quick successive highlights are all kept.
  const saveAnnotations = useCallback((change: (current: Annotations) => Partial<Annotations>) => {
    const run = saving.current.then(async () => {
      if (!projectId || !latest.current) return
      const { highlights, notes, ai } = latest.current
      setResearch(await api.research<Research>(projectId, 'save-annotations', { highlights, notes, ai, ...change({ highlights, notes, ai }) }))
    })
    saving.current = run.catch(() => {})
    return run
  }, [projectId, setResearch])
  useEffect(() => {
    setResearch(null)
    if (!projectId) return
    let active = true, running = false
    void reload().catch(error => { if (active) failed.current(message(error)) })
    const poll = async () => {
      if (running || document.visibilityState !== 'visible') return
      running = true
      try {
        if (await api.research<number>(projectId, 'pending') > 0) {
          const result = await api.research<{ imported: ResearchSource[] }>(projectId, 'scan-inbox')
          if (active && result.imported.length) await reload()
        }
      } catch (error) { if (active) { failed.current(message(error)); clearInterval(timer) } } finally { running = false }
    }
    const timer = window.setInterval(() => { void poll() }, INBOX_POLL_MS)
    return () => { active = false; clearInterval(timer) }
  }, [projectId, reload, setResearch])
  return { research, setResearch, reload, saveAnnotations }
}
