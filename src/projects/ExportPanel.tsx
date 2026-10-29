import { useEffect, useState } from 'react'
import type { ExportFormat, ExportTools, ExportResult, Project } from '../shared/types'
import { api } from '../shared/api'
import { orderedSections } from './manuscript'

export function ExportPanel({ project, disabled, result, run, quoted }: { project: Project; disabled: boolean; result: ExportResult | null; run: (format: ExportFormat, includeSources: boolean) => void; quoted: number }) {
  const [format, setFormat] = useState<ExportFormat>('markdown'), [tools, setTools] = useState<ExportTools | null>(null), [error, setError] = useState('')
  const [withSources, setWithSources] = useState(false)
  useEffect(() => { let active = true; void api.exportStatus().then(result => { if (active) setTools(result) }).catch(error => { if (active) setError(String(error)) }); return () => { active = false } }, [])
  const available = tools && (format === 'markdown' || tools.pandoc && (format !== 'pdf' || !!tools.pdfEngine))
  return <div className="export-panel"><p className="quiet">A copy of your whole manuscript, in its current chapter and scene order. Cards, notes and set-aside writing stay in Yazı.</p><div className="export-summary"><span className="section-label">THE MANUSCRIPT</span><h3>{project.title || 'Untitled'}</h3><p>{orderedSections(project).length} chapters and scenes</p></div>
    <label className="field">Export format<select value={format} onChange={e => setFormat(e.target.value as ExportFormat)}><option value="markdown">Markdown (.md)</option><option value="pdf">PDF (.pdf)</option><option value="docx">Word (.docx)</option><option value="epub">EPUB (.epub)</option></select></label>
    {error && <p className="modal-error" role="alert">{error}</p>}
    <div className="export-dependencies">{!tools && !error ? <p className="quiet">Checking local export tools…</p> : tools && <><p>{tools.pandoc ? tools.version : 'Markdown is ready. Install Pandoc for Word, EPUB and PDF.'}</p>{format === 'pdf' && <p>{tools.pdfEngine ? `PDF engine: ${tools.pdfEngine}` : 'PDF also needs Typst or XeLaTeX installed on this PC.'}</p>}</>}</div>
    <label className="acknowledge export-sources"><input type="checkbox" checked={withSources && quoted > 0} disabled={!quoted} onChange={e => setWithSources(e.target.checked)}/> {quoted ? `Add a Sources list at the end (${quoted} quoted ${quoted === 1 ? 'source' : 'sources'})` : 'Add a Sources list at the end (no sources quoted yet)'}</label>
    <button className="accent-button" disabled={disabled || !available} onClick={() => run(format, withSources && quoted > 0)}>{disabled ? 'Preparing your copy…' : 'Export manuscript'}</button>
    {result && <div className="export-result" role="status"><strong>Copy ready</strong><p>{result.filename}</p><small>{result.path}</small></div>}
    <p className="quiet export-note">Each export gets a new file. Existing copies stay safe.</p>
  </div>
}
