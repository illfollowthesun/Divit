import type { Project, ProjectType, Section } from '../shared/types'
import { newProject, slugify } from '../shared/types.ts'
import { t } from '../i18n/index.ts'

// Bringing in existing writing. Each file becomes one piece: the whole text of a blog post, a scene of a
// story, a chapter of a book. Only copies are made; the files the writer chose are never changed.
export type ImportFile = { name: string; kind: 'text' | 'docx'; text?: string; data?: string }
export type ImportedText = { name: string; title: string; body: string; images: number }

const stem = (name: string) => name.replace(/\.[^.]+$/, '').replace(/^\d+[\s._-]+(?=\S)/, '').replace(/[_]+/g, ' ').trim() || name
// Front matter is dropped (its title is kept); a leading "# Heading" becomes the title.
export function fromMarkdown(name: string, text: string, images = 0): ImportedText {
  let body = text.replace(/\r\n?/g, '\n'), title = ''
  const front = /^---\n([\s\S]*?)\n---\n?/.exec(body)
  if (front) { title = /^title:\s*["']?(.*?)["']?\s*$/m.exec(front[1])?.[1] ?? ''; body = body.slice(front[0].length) }
  const heading = /^\s*#\s+(.+?)\s*#*\s*(?:\n|$)/.exec(body)
  if (heading) { title ||= heading[1]; if (heading[1] === title) body = body.slice(heading[0].length) }
  return { name, title: title.trim() || stem(name), body: body.replace(/\n{3,}/g, '\n\n').trim(), images }
}
// Word files: Markdown via mammoth and turndown. Images are left out and counted.
export async function fromDocx(name: string, data: ArrayBuffer): Promise<ImportedText> {
  const [{ default: mammoth }, { default: TurndownService }] = await Promise.all([import('mammoth'), import('turndown')])
  let images = 0
  const result = await mammoth.convertToHtml({ arrayBuffer: data }, { convertImage: mammoth.images.imgElement(async () => { images++; return { src: '' } }) })
  const markdown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', emDelimiter: '*' })
  markdown.remove(['img'])
  return fromMarkdown(name, markdown.turndown(result.value), images)
}
export async function convert(files: ImportFile[]): Promise<ImportedText[]> {
  const out: ImportedText[] = []
  for (const file of files) {
    if (file.kind === 'docx') {
      const bytes = Uint8Array.from(atob(file.data ?? ''), c => c.charCodeAt(0))
      try { out.push(await fromDocx(file.name, bytes.buffer)) } catch { throw new Error(`${file.name} could not be read as a Word document. Save it as .docx and try again.`) }
    } else out.push(fromMarkdown(file.name, file.text ?? ''))
  }
  return out
}

const pieces = (texts: ImportedText[], kind: Section['kind']): Section[] => texts.map(t => ({ id: crypto.randomUUID(), kind, title: t.title, body: t.body }))
const joined = (texts: ImportedText[]) => texts.map(t => texts.length > 1 ? `## ${t.title}\n\n${t.body}` : t.body).filter(Boolean).join('\n\n')
export function importedProject(texts: ImportedText[], type: ProjectType, title: string): Project {
  const name = title.trim() || (texts.length === 1 ? texts[0].title : t('Imported writing'))
  const project = newProject(name, undefined, type)
  if (type === 'blog') return { ...project, body: joined(texts) }
  return { ...project, sections: pieces(texts, type === 'book' ? 'chapter' : 'scene') }
}
// Into the open project: after its existing text, never replacing any of it.
export function addImported(project: Project, texts: ImportedText[]): Partial<Project> {
  if (project.type === 'blog') return { body: [project.body.trim(), joined(texts)].filter(Boolean).join('\n\n'), ...(!project.title && texts.length === 1 ? { title: texts[0].title, slug: slugify(texts[0].title) } : {}) }
  return { sections: [...(project.sections ?? []), ...pieces(texts, project.type === 'book' ? 'chapter' : 'scene')] }
}
