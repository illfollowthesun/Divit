import { Readability } from '@mozilla/readability'
import DOMPurify from 'dompurify'
import TurndownService from 'turndown'
import type { ResearchSource } from '../shared/types'

export type PageMeta = Partial<Pick<ResearchSource, 'title' | 'url' | 'site' | 'author' | 'published' | 'type' | 'summary' | 'topic'>>

// Saved text stays close to plain prose: headings, paragraphs, lists and quotes. Link targets,
// emphasis markers, images and embeds are dropped, so the reader shows the words and highlights
// map straight onto the saved file.
const markdown = new TurndownService({ headingStyle: 'atx', bulletListMarker: '-', codeBlockStyle: 'fenced' })
markdown.remove(['img', 'picture', 'figure', 'iframe', 'video', 'audio', 'svg', 'canvas', 'form', 'button', 'noscript'] as TurndownService.Filter)
markdown.addRule('plainLinks', { filter: 'a', replacement: content => content })
markdown.addRule('plainEmphasis', { filter: ['strong', 'b', 'em', 'i'], replacement: content => content })

const isoDay = (value?: string | null) => { const date = value ? new Date(value) : null; return date && !Number.isNaN(date.getTime()) ? date.toISOString().slice(0, 10) : undefined }
const metaContent = (doc: Document, ...names: string[]) => names.map(name => doc.querySelector<HTMLMetaElement>(`meta[property="${name}"],meta[name="${name}"]`)?.content?.trim()).find(Boolean)

export function readablePage(html: string, url: string, contentType = 'text/html'): { meta: PageMeta; text: string } {
  const host = new URL(url).hostname.replace(/^www\./, '')
  if (/text\/plain/i.test(contentType)) return { meta: { title: url.split('/').filter(Boolean).pop() || host, url, site: host, type: 'other' }, text: html.trim() }
  // DOMParser documents are inert: no scripts run and nothing is loaded.
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const base = doc.createElement('base'); base.href = url; doc.head.prepend(base)
  const published = isoDay(metaContent(doc, 'article:published_time', 'datePublished', 'date', 'pubdate'))
  const ogType = metaContent(doc, 'og:type')
  const article = new Readability(doc.cloneNode(true) as Document, { charThreshold: 200 }).parse()
  const content = DOMPurify.sanitize(article?.content ?? doc.body?.innerHTML ?? '', { FORBID_TAGS: ['style', 'script', 'img', 'iframe'], FORBID_ATTR: ['style'] })
  const text = markdown.turndown(content).replace(/\n{3,}/g, '\n\n').trim()
  if (!text) throw new Error('No readable text was found on this page. Save the text into the inbox instead.')
  const site = (article?.siteName || metaContent(doc, 'og:site_name') || host).trim()
  // "Headline | Site name" → "Headline"
  const title = (article?.title || doc.title || host).trim(), suffix = new RegExp(`\\s+[|·–—-]\\s+${site.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i')
  return {
    meta: {
      title: title.replace(suffix, '') || title, url, site,
      author: article?.byline?.trim().replace(/^by\s+/i, '') || undefined, published: isoDay(article?.publishedTime) ?? published,
      type: ogType === 'article' && /news|haber|gazete|times|post|guardian|bbc|reuters/i.test(host) ? 'news' : 'article',
      summary: article?.excerpt?.trim() || undefined,
    },
    text,
  }
}
