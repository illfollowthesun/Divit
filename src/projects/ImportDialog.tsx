import { useState } from 'react'
import type { Project, ProjectType } from '../shared/types'
import { words } from '../shared/types'
import { api } from '../shared/api'
import { convert } from './import'
import { t, tn } from '../i18n'
import type { ImportedText } from './import'

const message = (e: unknown) => e instanceof Error ? e.message : String(e)
const becomes = (type: ProjectType) => type === 'blog' ? t('The files are joined into one post, each under its own heading.') : type === 'story' ? t('Each file becomes a scene.') : t('Each file becomes a chapter.')

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
    <p className="quiet">{t('Bring in Markdown, text or Word (.docx) files. Yazı makes its own copy; your original files are never moved or changed.')}</p>
    <div className="dialog-actions"><button type="button" className="outline-button" disabled={reading || busy} onClick={() => void choose(false)}>{t('Choose files…')}</button><button type="button" className="outline-button" disabled={reading || busy} onClick={() => void choose(true)}>{t('Choose a folder…')}</button></div>
    {reading && <p className="quiet" role="status">{t('Reading the files…')}</p>}
    {problem && <p className="modal-error" role="alert">{problem}</p>}
    {texts && <>
      <div className="import-list" aria-label={t('Files to bring in')}><span className="section-label">{tn(texts.length, '{n} FILE · {words} WORDS', '{n} FILES · {words} WORDS', { words: total })}</span><ol>{texts.map(text => <li key={text.name}><strong>{text.title}</strong> <small>{text.name} · {tn(words(text.body), '{n} word', '{n} words')}</small></li>)}</ol>
        {images > 0 && <p className="quiet">{tn(images, 'One image was left out. Add images from the Images tab.', '{n} images were left out. Add images from the Images tab.')}</p>}</div>
      <fieldset className="import-target"><legend>{t('Where should it go?')}</legend>
        <label className="acknowledge"><input type="radio" name="import-target" checked={target === 'new'} onChange={() => setTarget('new')}/> {t('A new project')}</label>
        <label className="acknowledge"><input type="radio" name="import-target" checked={target === 'open'} disabled={!project} onChange={() => setTarget('open')}/> {project ? t('Add to “{title}”, after its current text', { title: project.title || t('Untitled') }) : t('Add to the open project (none is open)')}</label>
      </fieldset>
      {target === 'new' && <><label className="field">{t('Project type')}<select value={type} onChange={e => setType(e.target.value as ProjectType)}><option value="blog">{t('Blog post')}</option><option value="story">{t('Story')}</option><option value="book">{t('Book')}</option></select></label>
        <label className="field">{t('Project title')}<input value={title} placeholder={t('A working title is enough')} onChange={e => setTitle(e.target.value)}/></label></>}
      <p className="quiet">{becomes(into)}</p>
      <button type="button" className="accent-button" disabled={busy || !texts.length} onClick={() => run(texts, target, type, title)}>{busy ? t('Bringing it in…') : t('Bring in')}</button>
    </>}
  </div>
}
