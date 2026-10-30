import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { SettingsForm } from '../../../src/settings/SettingsForm'
import { AiSettings } from '../../../src/settings/AiSettings'
import { applyTheme, resolveTheme } from '../../../src/themes'
import '../../../src/styles.css'
import '../../../src/polish/backup.css'

function Fixture() {
  const [value, setValue] = useState(''), [saved, setSaved] = useState(''), [closed, setClosed] = useState(false)
  if (closed) return <p>Closed</p>
  return <dialog open aria-label="Settings component preview"><div className="dialog-head"><h2>Settings</h2></div><SettingsForm
    dirty={value !== saved} busy={false} save={() => setSaved(value)} cancel={() => setClosed(true)} panels={{
      General: <label className="field">Interface language<select value={value} onChange={e => setValue(e.target.value)}><option value="">Same as Windows</option><option value="tr">Türkçe</option></select></label>,
      Writing: <><label className="field">Daily writing goal<input type="number"/></label>{Array.from({ length: 25 }, (_, i) => <p key={i}>The first ferry left before the city woke.</p>)}</>,
      Appearance: <label className="field">Theme<select onChange={e => applyTheme(resolveTheme(e.target.value as 'light', false))}>{['light', 'sage', 'blue', 'dark', 'terracotta', 'plum', 'system'].map(name => <option key={name}>{name}</option>)}</select></label>,
      'Your files': <p>Plain Markdown and JSON. No account or cloud sync.</p>, AI: <AiSettings/>, About: <p>Divit</p>,
    }}/></dialog>
}
applyTheme(resolveTheme('light', false))
createRoot(document.getElementById('root')!).render(<Fixture/>)
