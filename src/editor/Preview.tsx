import { useEffect, useState } from 'react'
import { t } from '../i18n'
import DOMPurify from 'dompurify'
import { marked, Renderer } from 'marked'
import { api } from '../shared/api'
import type { ImageRecord } from '../shared/types'
export function Preview({ text, images }: { text: string; images: ImageRecord[] }) {
  const [html, setHtml] = useState('')
  useEffect(() => {
    let active = true
    void (async () => {
      // Sanitize before substituting trusted, local image data. Raw HTML never gets privileges.
      const container = document.createElement('div')
      const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
      const renderer = new Renderer()
      renderer.image = ({ href, text }: { href: string; text: string }) => {
        const match = href.match(/^yazi-image:([a-zA-Z0-9-]+)$/)
        return match ? `<img data-local-id="${match[1]}" alt="${escape(text)}">` : `<span>[${t('Image')}: ${escape(text || t('not loaded'))}]</span>`
      }
      container.innerHTML = DOMPurify.sanitize(marked.parse(text, { async: false, renderer }), { FORBID_ATTR: ['src', 'srcset'] })
      for (const img of container.querySelectorAll('img')) {
        const id = img.getAttribute('data-local-id')
        const image = id && images.find(i => i.id === id)
        if (image) img.src = await api.imageData(image)
        else { img.removeAttribute('src'); img.alt = img.alt || t('External image (not loaded)') }
      }
      for (const a of container.querySelectorAll('a')) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener noreferrer') }
      if (active) setHtml(container.innerHTML)
    })().catch(() => { if (active) setHtml(`<p>${t('Could not load the preview.')}</p>`) })
    return () => { active = false }
  }, [text, images])
  return text.trim() ? <article className="prose" dangerouslySetInnerHTML={{ __html: html }} /> : <p className="quiet empty-preview">{t('Your words will take shape here.')}</p>
}
