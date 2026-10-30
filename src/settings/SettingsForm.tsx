import { useId, useRef, useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { t } from '../i18n'
import './settings.css'

const sections = ['General', 'Writing', 'Appearance', 'Your files', 'AI', 'About'] as const
type Section = typeof sections[number]

// The shell owns settings persistence and the modal; this component owns its contents.
// Keep every section mounted so switching tabs preserves drafts and pending key entry.
export function SettingsForm({ panels, dirty, busy, save, cancel }: {
  panels: Record<Section, ReactNode>
  dirty: boolean
  busy: boolean
  save: () => void
  cancel: () => void
}) {
  const [active, setActive] = useState<Section>('General')
  const id = useId(), tabs = useRef<(HTMLButtonElement | null)[]>([])
  function submit(event: FormEvent) { event.preventDefault(); if (dirty && !busy) save() }
  return <form className="settings-form" onSubmit={submit}>
    <div className="settings-body">
      <div className="settings-tabs" role="tablist" aria-label={t('Settings sections')} aria-orientation="vertical">
        {sections.map((name, index) => <button type="button" key={name} ref={element => { tabs.current[index] = element }} role="tab"
          id={`${id}-tab-${index}`} aria-controls={`${id}-panel-${index}`} aria-selected={active === name} tabIndex={active === name ? 0 : -1}
          onClick={() => setActive(name)} onKeyDown={event => {
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? sections.length - 1 : event.key === 'ArrowDown' ? (index + 1) % sections.length : event.key === 'ArrowUp' ? (index + sections.length - 1) % sections.length : null
            if (next !== null) { event.preventDefault(); setActive(sections[next]); tabs.current[next]?.focus() }
          }}>{t(name)}</button>)}
      </div>
      <div className="settings-sections">{sections.map((name, index) => <section key={name} role="tabpanel" id={`${id}-panel-${index}`}
        aria-labelledby={`${id}-tab-${index}`} hidden={active !== name} tabIndex={0}>{panels[name]}</section>)}</div>
    </div>
    <footer className="settings-footer"><button type="button" onClick={cancel} disabled={busy}>{t('Cancel')}</button><button className="accent-button" disabled={busy || !dirty}>{t('Save settings')}</button></footer>
  </form>
}
