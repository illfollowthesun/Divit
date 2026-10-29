import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from '../shared/api'
import type { Research, ResearchSource } from '../shared/types'

const message = (e: unknown) => e instanceof Error ? e.message : String(e)
export const INBOX_POLL_MS = 1000

// Loads a project's research and imports files dropped into its inbox while the project is open.
export function useResearch(projectId: string | null, onError: (message: string) => void) {
  const [research, setResearch] = useState<Research | null>(null)
  const failed = useRef(onError); failed.current = onError
  const reload = useCallback(async () => {
    if (!projectId) return null
    const loaded = await api.research<Research>(projectId, 'load'); setResearch(loaded); return loaded
  }, [projectId])
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
  }, [projectId, reload])
  return { research, setResearch, reload }
}
