import { useEffect, useState } from 'react'
import type { ExportFormat, ExportTools, ExportResult, Project } from '../shared/types'
import { api, desktop } from '../shared/api'
import { orderedSections } from './manuscript'
import { t, tn } from '../i18n'

export type ExportEngine = 'builtin' | 'pandoc'
// Markdown, Word and PDF are made by the built-in exporter, with no extra tools. Pandoc (with Typst or
// XeLaTeX for PDF) is the optional higher-quality path, and the only one for EPUB.
const formats: { id: ExportFormat; name: string; ext: string }[] = [{ id: 'docx', name: 'Word', ext: '.docx' }, { id: 'pdf', name: 'PDF', ext: '.pdf' }, { id: 'markdown', name: 'Markdown', ext: '.md' }, { id: 'epub', name: 'EPUB', ext: '.epub' }]
export function ExportPanel({ project, disabled, result, run, quoted }: { project: Project; disabled: boolean; result: ExportResult | null; run: (format: ExportFormat, includeSources: boolean, engine: ExportEngine) => void; quoted: number }) {
  const [format, setFormat] = useState<ExportFormat>('docx'), [tools, setTools] = useState<ExportTools | null>(null), [checked, setChecked] = useState(false)
  const [withSources, setWithSources] = useState(false), [usePandoc, setUsePandoc] = useState(false), [stale, setStale] = useState(true)
  // Without Node.js or Pandoc the check simply finds no Pandoc; the built-in path still works.
  useEffect(() => { let active = true; void api.exportStatus().then(result => { if (active) setTools(result) }).catch(() => {}).finally(() => { if (active) setChecked(true) }); return () => { active = false } }, [])
  // A finished copy replaces the button until the writer changes what to export.
  useEffect(() => setStale(false), [result])
  useEffect(() => setStale(true), [format, withSources, usePandoc])
  const pandocReady = !!tools?.pandoc && (format !== 'pdf' || !!tools.pdfEngine)
  const engine: ExportEngine = format === 'epub' || usePandoc && pandocReady && format !== 'markdown' ? 'pandoc' : 'builtin'
  const available = engine === 'builtin' || pandocReady
  const how = (id: ExportFormat) => id !== 'epub' ? t('Made by Divit itself. No extra tools are needed.')
    : !checked ? t('Checking local export tools…') : tools?.pandoc ? t('EPUB is made with {version}.', { version: tools.version }) : t('EPUB needs Pandoc. Install Pandoc from pandoc.org and reopen Divit, or choose Word, PDF or Markdown.')
  const sections = orderedSections(project).length
  const done = result && !stale
  return <div className="export-panel">
    <p className="export-what"><strong>{project.title || t('Untitled')}</strong>{project.type !== 'blog' && <> · {t('{n} chapters and scenes', { n: sections })}</>}</p>
    <fieldset className="export-formats"><legend className="sr-only">{t('Export format')}</legend>
      {formats.map(item => <div key={item.id} className={`export-row ${format === item.id ? 'selected' : ''}`}>
        <label><input type="radio" name="export-format" value={item.id} checked={format === item.id} aria-labelledby={`export-name-${item.id}`} aria-describedby={`export-how-${item.id}`} onChange={() => setFormat(item.id)}/>
          <span className="export-row-text"><span className="export-row-name"><strong id={`export-name-${item.id}`}>{item.name}</strong><code>{item.ext}</code></span><small id={`export-how-${item.id}`}>{how(item.id)}</small></span></label>
        {format === item.id && item.id !== 'epub' && item.id !== 'markdown' && tools?.pandoc && <label className="export-pandoc"><input type="checkbox" checked={usePandoc} disabled={!pandocReady} onChange={e => setUsePandoc(e.target.checked)}/> {pandocReady ? t('Use {version} instead, for finer typesetting', { version: tools.version }) : t('Pandoc is installed, but PDF also needs Typst or XeLaTeX.')}</label>}
      </div>)}
      <label className="export-row export-sources"><input type="checkbox" checked={withSources && quoted > 0} disabled={!quoted} aria-describedby="export-sources-why" onChange={e => setWithSources(e.target.checked)}/>
        <span className="export-row-text"><span className="export-row-name"><strong>{t('Add a Sources list at the end')}</strong></span><small id="export-sources-why">{quoted ? tn(quoted, '{n} quoted source', '{n} quoted sources') : t('No sources quoted yet')}</small></span></label>
    </fieldset>
    {done
      ? <div className="export-result" role="status"><div className="export-result-line"><strong>{result.filename}</strong>{desktop && <button type="button" className="outline-button" onClick={() => void api.revealInFolder(result.path).catch(() => {})}>{t('Show in folder')}</button>}</div>
          <small>{t('Copy ready')} <i>·</i> {result.engine === 'built-in' ? t('Made with the built-in exporter.') : result.engine && result.engine !== 'plain-markdown' ? t('Made with {engine}.', { engine: result.engine }) : t('Made with the built-in exporter.')}</small>{!desktop && <small className="export-path">{result.path}</small>}</div>
      : <button className="accent-button" disabled={disabled || !available} onClick={() => run(format, withSources && quoted > 0, engine)}>{disabled ? t('Preparing your copy…') : t('Export manuscript')}</button>}
    <p className="quiet export-note">{t('A copy of your whole manuscript, in its current chapter and scene order. Cards, notes and set-aside writing stay in Divit.')} {t('Each export gets a new file. Existing copies stay safe.')}</p>
  </div>
}
