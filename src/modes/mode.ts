import type { Project, Settings, WritingMode } from '../shared/types'

export const modes: WritingMode[] = ['write', 'review', 'normal']
export const modeNames: Record<WritingMode, string> = { write: 'Write', review: 'Review', normal: 'Normal' }

// A document opens in its own last mode; one never switched opens in the last mode used anywhere.
export const startMode = (project: Pick<Project, 'mode'> | null, settings: Pick<Settings, 'lastMode'>): WritingMode =>
  project?.mode ?? settings.lastMode ?? 'normal'

// Never in Write, always in Review, in Normal only after explicit opt-in.
export const underlinesShown = (mode: WritingMode, settings: Pick<Settings, 'underlines'>) =>
  mode === 'review' || mode === 'normal' && settings.underlines === true

// Ctrl 1 / 2 / 3. Ctrl Alt 1 / 2 add a chapter or scene and stay as they are.
export function shortcutMode(event: Pick<KeyboardEvent, 'ctrlKey' | 'metaKey' | 'altKey' | 'shiftKey' | 'code'>): WritingMode | null {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.shiftKey) return null
  return ({ Digit1: 'write', Digit2: 'review', Digit3: 'normal' } as const)[event.code as 'Digit1'] ?? null
}
