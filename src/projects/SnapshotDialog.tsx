import { SnapshotDiff } from './SnapshotDiff'
import { useState } from 'react'
import type { Project, Snapshot } from '../shared/types'
import { snapshotText, takeSnapshot } from './snapshots'
import { language, t } from '../i18n'

export function Snapshots({ project, scopeId, keep, restore, disabled }: { project: Project; scopeId: string | null; keep: (label: string) => void; restore: (snapshot: Snapshot) => void; disabled: boolean }) {
  const [chosen, setChosen] = useState(''), [label, setLabel] = useState('')
  const snapshots = [...(project.snapshots ?? [])].reverse()
  const selected = snapshots.find(s => s.id === chosen) ?? snapshots.find(s => s.scopeId === scopeId) ?? snapshots[0]
  const current = selected ? takeSnapshot(project, selected.scopeId, t('Current writing')) : null
  return <div className="snapshots-dialog"><p className="quiet">{t('Keep a version before rewriting. Restoring also keeps a snapshot of your current writing.')}</p><form className="snapshot-capture" onSubmit={e => { e.preventDefault(); keep(label); setLabel('') }}><input aria-label={t('Snapshot label')} value={label} onChange={e => setLabel(e.target.value)} placeholder={t('Before a rewrite, a different ending…')}/><button className="accent-button" disabled={disabled}>{t('Keep snapshot')}</button></form>
    {selected && current ? <><label className="field">{t('Snapshot to compare')}<select value={selected.id} onChange={e => setChosen(e.target.value)}>{snapshots.map(s => <option key={s.id} value={s.id}>{s.title} · {s.label} · {new Date(s.createdAt).toLocaleString(language() === 'tr' ? 'tr-TR' : 'en-GB')}</option>)}</select></label><SnapshotDiff before={snapshotText(selected)} after={snapshotText(current)} beforeTitle={selected.title} afterTitle={current.title}/><button className="outline-button" disabled={disabled} onClick={() => restore(selected)}>{t('Restore this version')}</button></> : <div className="empty-room">{t('A version worth keeping starts here.')}</div>}
  </div>
}
