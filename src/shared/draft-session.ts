import type { Project } from './types'

export type SaveStatus = 'All changes saved' | 'Saving…' | 'Unsaved changes' | 'Not saved — your text is still here'

export function canonicalDraft(project: Project): string {
  return JSON.stringify(project, (key, value: unknown) => {
    if (key === 'revision') return undefined
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0))
    }
    return value
  })
}

type Events = {
  changed: (project: Project | null, status: SaveStatus) => void
  saved: (project: Project) => void
  failed: (error: unknown) => void
}

// Owns a draft's in-memory edits independently of rendering and backend key order.
// Flush drains every edit made while a write is in flight, then resolves.
export class DraftSession {
  private current: Project | null = null
  private persisted = ''
  private queue: Promise<void> = Promise.resolve()
  private save: (project: Project) => Promise<Project>
  private events: Events

  constructor(save: (project: Project) => Promise<Project>, events: Events) {
    this.save = save
    this.events = events
  }

  get project(): Project | null { return this.current }
  get dirty(): boolean { return this.current !== null && canonicalDraft(this.current) !== this.persisted }

  select(project: Project | null): void {
    if (this.dirty) throw new Error('Your current text has not been saved. Save or copy it before opening another draft.')
    this.current = project ? structuredClone(project) : null
    this.persisted = project ? canonicalDraft(project) : ''
    this.events.changed(this.current, 'All changes saved')
  }

  // Settings such as the writing mode are saved without counting as an edit to the writing.
  edit(patch: Partial<Project>, touch = true): void {
    if (!this.current) return
    this.current = { ...this.current, ...patch, ...(touch ? { updatedAt: new Date().toISOString() } : {}) }
    this.events.changed(this.current, 'Unsaved changes')
  }

  flush(): Promise<void> {
    const next = this.queue.catch(() => {}).then(() => this.drain())
    this.queue = next
    return next
  }

  private async drain(): Promise<void> {
    while (this.current && this.dirty) {
      const snapshot = structuredClone(this.current)
      this.events.changed(this.current, 'Saving…')
      try {
        const result = await this.save(snapshot)
        this.events.saved(result)
        // Selection cannot change while dirty. Newer edits keep their text and get
        // the revision of the successful write before the next queued save.
        this.persisted = canonicalDraft(result)
        this.current = { ...this.current, revision: result.revision }
        this.events.changed(this.current, this.dirty ? 'Unsaved changes' : 'All changes saved')
      } catch (error) {
        this.events.changed(this.current, 'Not saved — your text is still here')
        this.events.failed(error)
        throw error
      }
    }
  }
}
