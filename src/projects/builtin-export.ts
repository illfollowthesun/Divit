import type { Project, ResearchSource } from '../shared/types'
import { citation } from '../research/citation'
import { manuscriptText } from './manuscript'
import { documentBlocks } from './document-blocks'
import type { Block, Run } from './document-blocks'
import { t } from '../i18n'

// Export without Pandoc or Node: the window builds the Markdown, Word or PDF file itself.
// Pandoc stays the optional higher-quality path (and the only one for EPUB).
export type BuiltinFormat = 'markdown' | 'docx' | 'pdf'
export type Images = Record<string, string> // image id -> data URL

export function manuscript(project: Project, images: Images, sources: ResearchSource[]) {
  const body = manuscriptText(project)
  if (!body.trim()) throw new Error(t('Write a little before exporting.'))
  const text = body.replace(/yazi-image:([a-zA-Z0-9-]+)/g, (_, id: string) => { if (!images[id]) throw new Error(t('An image in the text is missing from the library.')); return images[id] })
  const list = sources.length ? `\n\n# ${t('Sources')}\n\n${sources.map(source => `- ${citation(source).replace(/[\r\n]+/g, ' ')}`).join('\n')}` : ''
  return { title: project.title || t('Untitled'), text: `${text}${list}` }
}
// Every image is redrawn as PNG so Word and PDF accept WebP and AVIF originals too.
async function png(src: string): Promise<{ data: string; bytes: Uint8Array; width: number; height: number } | null> {
  if (!src.startsWith('data:image/')) return null
  const image = new Image(); image.src = src
  try { await image.decode() } catch { return null }
  const canvas = document.createElement('canvas'); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight
  canvas.getContext('2d')!.drawImage(image, 0, 0)
  const data = canvas.toDataURL('image/png'), bytes = Uint8Array.from(atob(data.split(',')[1]), c => c.charCodeAt(0))
  return { data, bytes, width: image.naturalWidth, height: image.naturalHeight }
}
const fit = (w: number, h: number, max: number) => w > max ? { width: max, height: Math.round(h * max / w) } : { width: w, height: h }

export async function toDocx(title: string, markdown: string): Promise<Uint8Array> {
  const d = await import('docx')
  const runs = (list: Run[]) => list.map(r => {
    const text = new d.TextRun({ text: r.text, bold: r.bold, italics: r.italic, strike: r.strike, superScript: r.sup, font: r.code ? 'Consolas' : undefined, break: r.text === '\n' ? 1 : undefined })
    return r.link ? new d.ExternalHyperlink({ link: r.link, children: [new d.TextRun({ text: r.text, style: 'Hyperlink', bold: r.bold, italics: r.italic })] }) : text
  })
  const headings = [d.HeadingLevel.HEADING_1, d.HeadingLevel.HEADING_2, d.HeadingLevel.HEADING_3, d.HeadingLevel.HEADING_4, d.HeadingLevel.HEADING_5, d.HeadingLevel.HEADING_6]
  async function paragraphs(blocks: Block[], quote = false): Promise<InstanceType<typeof d.Paragraph>[]> {
    const out: InstanceType<typeof d.Paragraph>[] = []
    for (const block of blocks) {
      if (block.kind === 'heading') out.push(new d.Paragraph({ heading: headings[block.level - 1], children: runs(block.runs) }))
      else if (block.kind === 'paragraph') out.push(new d.Paragraph({ children: runs(block.runs), indent: quote ? { left: 720 } : undefined, spacing: { after: 160 } }))
      else if (block.kind === 'quote') out.push(...await paragraphs(block.blocks, true))
      else if (block.kind === 'list') block.items.forEach((item, i) => out.push(new d.Paragraph({ children: [new d.TextRun(block.ordered ? `${block.start + i}. ` : '• '), ...runs(item)], indent: { left: 360 } })))
      else if (block.kind === 'code') out.push(new d.Paragraph({ children: block.text.split('\n').map((line, i) => new d.TextRun({ text: line, font: 'Consolas', break: i ? 1 : undefined })) }))
      else if (block.kind === 'rule') out.push(new d.Paragraph({ children: [new d.TextRun('* * *')], alignment: d.AlignmentType.CENTER }))
      else if (block.kind === 'image') {
        const picture = await png(block.src)
        if (picture) out.push(new d.Paragraph({ alignment: d.AlignmentType.CENTER, children: [new d.ImageRun({ type: 'png', data: picture.bytes, transformation: fit(picture.width, picture.height, 600), altText: { name: block.alt || 'image', title: block.alt, description: block.alt } })] }))
      }
    }
    return out
  }
  const document = new d.Document({
    creator: 'Yazı', title,
    styles: { default: { document: { run: { font: 'Georgia', size: 24 } } } },
    sections: [{ children: [new d.Paragraph({ heading: d.HeadingLevel.TITLE, children: [new d.TextRun(title)] }), ...await paragraphs(documentBlocks(markdown, t('Notes')))] }],
  })
  return new Uint8Array(await (await d.Packer.toBlob(document)).arrayBuffer())
}

export async function toPdf(title: string, markdown: string): Promise<Uint8Array> {
  const [{ default: pdfMake }, { default: vfs }] = await Promise.all([import('pdfmake/build/pdfmake'), import('pdfmake/build/vfs_fonts')])
  pdfMake.addVirtualFileSystem(vfs)
  const text = (list: Run[]) => list.map(r => ({ text: r.text, bold: r.bold, italics: r.italic, decoration: r.strike ? 'lineThrough' : r.link ? 'underline' : undefined, link: r.link, sups: r.sup, fontSize: r.code ? 10 : undefined }))
  async function content(blocks: Block[], quote = false): Promise<unknown[]> {
    const out: unknown[] = []
    for (const block of blocks) {
      if (block.kind === 'heading') out.push({ text: text(block.runs), style: `h${Math.min(block.level, 3)}` })
      else if (block.kind === 'paragraph') out.push({ text: text(block.runs), margin: [quote ? 24 : 0, 0, 0, 8], italics: quote || undefined })
      else if (block.kind === 'quote') out.push(...await content(block.blocks, true))
      else if (block.kind === 'list') out.push({ [block.ordered ? 'ol' : 'ul']: block.items.map(text), start: block.start, margin: [0, 0, 0, 8] })
      else if (block.kind === 'code') out.push({ text: block.text, fontSize: 10, margin: [0, 0, 0, 8], preserveLeadingSpaces: true })
      else if (block.kind === 'rule') out.push({ text: '* * *', alignment: 'center', margin: [0, 8, 0, 8] })
      else if (block.kind === 'image') { const picture = await png(block.src); if (picture) out.push({ image: picture.data, fit: [451, 600], alignment: 'center', margin: [0, 4, 0, 10] }) }
    }
    return out
  }
  const definition = {
    info: { title, creator: 'Yazı' }, pageSize: 'A4', pageMargins: [72, 72, 72, 72],
    defaultStyle: { font: 'Roboto', fontSize: 11, lineHeight: 1.35 },
    styles: { title: { fontSize: 24, margin: [0, 0, 0, 20] }, h1: { fontSize: 18, bold: true, margin: [0, 16, 0, 8] }, h2: { fontSize: 15, bold: true, margin: [0, 12, 0, 6] }, h3: { fontSize: 13, bold: true, margin: [0, 10, 0, 4] } },
    footer: (page: number, pages: number) => ({ text: `${page} / ${pages}`, alignment: 'center', fontSize: 9, color: '#777', margin: [0, 24, 0, 0] }),
    content: [{ text: title, style: 'title' }, ...await content(documentBlocks(markdown, t('Notes')))],
  }
  return new Uint8Array(await pdfMake.createPdf(definition).getBuffer())
}

export async function builtinFile(format: BuiltinFormat, project: Project, images: Images, sources: ResearchSource[]): Promise<Uint8Array> {
  const { title, text } = manuscript(project, images, sources)
  if (format === 'markdown') return new TextEncoder().encode(`---\ntitle: ${JSON.stringify(title)}\n---\n\n${text}\n`)
  return format === 'docx' ? toDocx(title, text) : toPdf(title, text)
}
