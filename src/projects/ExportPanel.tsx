import { useEffect, useState } from 'react'
import type { ExportFormat, ExportTools, ExportResult, Project } from '../shared/types'
import { api } from '../shared/api'
import { orderedSections } from './manuscript'
import { t, tn } from '../i18n'

export type ExportEngine = 'builtin' | 'pandoc'
// Markdown, Word and PDF are made by the built-in exporter, with no extra tools. Pandoc (with Typst or
// XeLaTeX for PDF) is the optional higher-quality path, and the only one for EPUB.
export function ExportPanel({ project, disabled, result, run, quoted }: { project: Project; disabled: boolean; result: ExportResult | null; run: (format: ExportFormat, includeSources: boolean, engine: ExportEngine) => void; quoted: number }) {
  const [format, setFormat] = useState<ExportFormat>('docx'), [tools, setTools] = useState<ExportTools | null>(null), [checked, setChecked] = useState(false)
  const [withSources, setWithSources] = useState(false), [usePandoc, setUsePandoc] = useState(false)
  // Without Node.js or Pandoc the check simply finds no Pandoc; the built-in path still works.
  useEffect(() => { let active = true; void api.exportStatus().then(result => { if (active) setTools(result) }).catch(() => {}).finally(() => { if (active) setChecked(true) }); return () => { active = false } }, [])
  const pandocReady = !!tools?.pandoc && (format !== 'pdf' || !!tools.pdfEngine)
  const engine: ExportEngine = format === 'epub' || usePandoc && pandocReady && format !== 'markdown' ? 'pandoc' : 'builtin'
  const available = engine === 'builtin' || pandocReady
  return <div className="export-panel"><p className="quiet">{t('A copy of your whole manuscript, in its current chapter and scene order. Cards, notes and set-aside writing stay in Yazı.')}</p><div className="export-summary"><span className="section-label">{t('THE MANUSCRIPT')}</span><h3>{project.title || t('Untitled')}</h3>{project.type !== 'blog' && <p>{t('{n} chapters and scenes', { n: orderedSections(project).length })}</p>}</div>
    <label className="field">{t('Export format')}<select value={format} onChange={e => setFormat(e.target.value as ExportFormat)}><option value="docx">Word (.docx)</option><option value="pdf">PDF (.pdf)</option><option value="markdown">Markdown (.md)</option><option value="epub">{t('EPUB (.epub, needs Pandoc)')}</option></select></label>
    <div className="export-dependencies">
      {format === 'epub'
        ? <p>{!checked ? t('Checking local export tools…') : tools?.pandoc ? t('EPUB is made with {version}.', { version: tools.version }) : t('EPUB needs Pandoc. Install Pandoc from pandoc.org and reopen Yazı, or choose Word, PDF or Markdown.')}</p>
        : <p>{t('Made by Yazı itself. No extra tools are needed.')}</p>}
      {format !== 'epub' && format !== 'markdown' && tools?.pandoc && <label className="acknowledge"><input type="checkbox" checked={usePandoc} disabled={!pandocReady} onChange={e => setUsePandoc(e.target.checked)}/> {pandocReady ? t('Use {version} instead, for finer typesetting', { version: tools.version }) : t('Pandoc is installed, but PDF also needs Typst or XeLaTeX.')}</label>}
    </div>
    <label className="acknowledge export-sources"><input type="checkbox" checked={withSources && quoted > 0} disabled={!quoted} onChange={e => setWithSources(e.target.checked)}/> {quoted ? tn(quoted, 'Add a Sources list at the end ({n} quoted source)', 'Add a Sources list at the end ({n} quoted sources)') : t('Add a Sources list at the end (no sources quoted yet)')}</label>
    <button className="accent-button" disabled={disabled || !available} onClick={() => run(format, withSources && quoted > 0, engine)}>{disabled ? t('Preparing your copy…') : t('Export manuscript')}</button>
    {result && <div className="export-result" role="status"><strong>{t('Copy ready')}</strong><p>{result.filename}</p><small>{result.path}</small><small className="export-engine">{result.engine === 'built-in' ? t('Made with the built-in exporter.') : result.engine && result.engine !== 'plain-markdown' ? t('Made with {engine}.', { engine: result.engine }) : t('Made with the built-in exporter.')}</small></div>}
    <p className="quiet export-note">{t('Each export gets a new file. Existing copies stay safe.')}</p>
  </div>
}
