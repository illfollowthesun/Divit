import { useState } from 'react'
import type { Project, ProjectType } from '../shared/types'
import { words } from '../shared/types'
import { api } from '../shared/api'
import { convert } from './import'
import type { ImportedText } from './import'

const message = (e: unknown) => e instanceof Error ? e.message : String(e)
const becomes: Record<ProjectType, string> = { blog: 'The files are joined into one post, each under its own heading.', story: 'Each file becomes a scene.', book: 'Each file becomes a chapter.' }

// Bring in .md, .txt and .docx files, one by one or a whole folder. Copies only: the originals stay as they are.
export function ImportDialog({ project, busy, run }: { project: Project | null; busy: boolean; run: (texts: ImportedText[], target: 'new' | 'open', type: ProjectType, title: string) => void }) {
  const [texts, setTexts] = useState<ImportedText[] | null>(null), [reading, setReading] = useState(false), [problem, setProblem] = useState('')
  const [target, setTarget] = useState<'new' | 'open'>('new'), [type, setType] = useState<ProjectType>('story'), [title, setTitle] = useState('')
  async function choose(folder: boolean) {
    setReading(true); setProblem('')
    try {
      const files = await api.chooseImport(folder)
      if (!files.length) return
      const read = await convert(files)
      setTexts(read); setType(read.length > 1 ? 'book' : 'story'); setTitle(read.length === 1 ? read[0].title : '')
    } catch (error) { setProblem(message(error)) } finally { setReading(false) }
  }
  const total = texts?.reduce((sum, t) => sum + words(t.body), 0) ?? 0, images = texts?.reduce((sum, t) => sum + t.images, 0) ?? 0
  const into = target === 'open' && project ? project.type : type
  return <div className="import-dialog">
    <p className="quiet">Bring in Markdown, text or Word (.docx) files. Yazı makes its own copy; your original files are never moved or changed.</p>
    <div className="dialog-actions"><button type="button" className="outline-button" disabled={reading || busy} onClick={() => void choose(false)}>Choose files…</button><button type="button" className="outline-button" disabled={reading || busy} onClick={() => void choose(true)}>Choose a folder…</button></div>
    {reading && <p className="quiet" role="status">Reading the files…</p>}
    {problem && <p className="modal-error" role="alert">{problem}</p>}
    {texts && <>
      <div className="import-list" aria-label="Files to bring in"><span className="section-label">{texts.length} {texts.length === 1 ? 'FILE' : 'FILES'} · {total.toLocaleString()} WORDS</span><ol>{texts.map(t => <li key={t.name}><strong>{t.title}</strong> <small>{t.name} · {words(t.body).toLocaleString()} words</small></li>)}</ol>
        {images > 0 && <p className="quiet">{images === 1 ? 'One image was' : `${images} images were`} left out. Add images from the Images tab.</p>}</div>
      <fieldset className="import-target"><legend>Where should it go?</legend>
        <label className="acknowledge"><input type="radio" name="import-target" checked={target === 'new'} onChange={() => setTarget('new')}/> A new project</label>
        <label className="acknowledge"><input type="radio" name="import-target" checked={target === 'open'} disabled={!project} onChange={() => setTarget('open')}/> {project ? `Add to “${project.title || 'Untitled'}”, after its current text` : 'Add to the open project (none is open)'}</label>
      </fieldset>
      {target === 'new' && <><label className="field">Project type<select value={type} onChange={e => setType(e.target.value as ProjectType)}><option value="blog">Blog post</option><option value="story">Story</option><option value="book">Book</option></select></label>
        <label className="field">Project title<input value={title} placeholder="A working title is enough" onChange={e => setTitle(e.target.value)}/></label></>}
      <p className="quiet">{becomes[into]}</p>
      <button type="button" className="accent-button" disabled={busy || !texts.length} onClick={() => run(texts, target, type, title)}>{busy ? 'Bringing it in…' : 'Bring in'}</button>
    </>}
  </div>
}
