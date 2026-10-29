import { useState } from 'react'
import { api, desktop } from '../shared/api'
import { language, t, tn } from '../i18n'

const message = (e: unknown) => e instanceof Error ? e.message : String(e)
type Plan = { folder: string; root: string; existing: boolean; projects: number; changedAt: number | null }

// Settings → Your files: where the library lives, and moving it (for example into OneDrive or Dropbox).
export function LibraryLocation({ dataRoot, beforeMove, afterMove }: { dataRoot: string; beforeMove: () => Promise<void>; afterMove: () => Promise<unknown> }) {
  const [plan, setPlan] = useState<Plan | null>(null), [working, setWorking] = useState(false), [problem, setProblem] = useState(''), [done, setDone] = useState('')
  async function choose() {
    setProblem(''); setDone('')
    try {
      const folder = await api.chooseLibraryFolder()
      if (folder) setPlan({ folder, ...await api.libraryLocation(folder) })
    } catch (error) { setProblem(message(error)) }
  }
  async function go(mode: 'move' | 'use') {
    if (!plan || working) return
    setWorking(true); setProblem('')
    try {
      await beforeMove()
      const result = await api.moveLibrary(plan.folder, mode)
      await afterMove(); setPlan(null)
      setDone(mode === 'move' ? t('Your library is now in {root}. The old folder was kept at {previous}; delete it yourself once you have checked the new one.', { root: result.dataRoot, previous: result.previous }) : t('Now using the library in {root}. The previous folder was not changed.', { root: result.dataRoot }))
    } catch (error) { setProblem(message(error)) } finally { setWorking(false) }
  }
  const changed = plan?.changedAt ? new Date(plan.changedAt).toLocaleString(language() === 'tr' ? 'tr-TR' : 'en-GB') : ''
  return <div className="settings-info"><span className="section-label">{t('YOUR FILES')}</span><p>{dataRoot}</p><small>{t('Plain Markdown and JSON. No account or cloud sync.')}</small>
    {desktop && !plan && <div><button type="button" className="outline-button library-move" onClick={() => void choose()}>{t('Move library…')}</button></div>}
    {plan && <div className="library-plan" role="group" aria-label={t('Move library')}>
      <p className="library-warning">{t('Only one computer should have the app open on this library at a time. OneDrive, Dropbox and similar apps can make conflicted copies if two computers change the same files.')}</p>
      {plan.existing
        ? <p>{tn(plan.projects, 'There is already a library in {root} with {n} project, last changed {changed}. Use it instead? Your current library stays where it is.', 'There is already a library in {root} with {n} projects, last changed {changed}. Use it instead? Your current library stays where it is.', { root: plan.root, changed })}</p>
        : <p>{t('Your library will be copied to {root}, each file checked, and then used from there. The current folder is kept.', { root: plan.root })}</p>}
      <div className="dialog-actions"><button type="button" className="accent-button" disabled={working} onClick={() => void go(plan.existing ? 'use' : 'move')}>{working ? t('Copying and checking…') : plan.existing ? t('Use this library') : t('Move here')}</button><button type="button" disabled={working} onClick={() => setPlan(null)}>{t('Cancel')}</button></div>
    </div>}
    {problem && <p className="research-problem" role="alert">{problem}</p>}
    {done && <p className="ai-note" role="status">{done}</p>}
  </div>
}
