import { test, expect } from '@playwright/test'
import { createRequire } from 'node:module'
const JSZip = createRequire(import.meta.url)('jszip')

// A minimal real Word document: a heading, a paragraph with bold text, and a list.
async function docx(title: string, paragraph: string) {
  const zip = new JSZip()
  zip.file('[Content_Types].xml', '<?xml version="1.0"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>')
  zip.file('_rels/.rels', '<?xml version="1.0"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>')
  zip.file('word/document.xml', `<?xml version="1.0"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${title}</w:t></w:r></w:p>
    <w:p><w:r><w:t xml:space="preserve">${paragraph} </w:t></w:r><w:r><w:rPr><w:b/></w:rPr><w:t>Bold words.</w:t></w:r></w:p>
  </w:body></w:document>`)
  return zip.generateAsync({ type: 'nodebuffer' })
}

test('Word and Markdown files come in as chapters of a new book, or after the open project’s text', async ({ page }) => {
  await page.goto('/'); await page.evaluate(() => localStorage.clear()); await page.reload()
  await page.locator('#writing-library').getByRole('button', { name: 'Bring in writing…' }).click()
  const dialog = page.getByRole('dialog', { name: 'Bring in your writing' })
  await expect(dialog).toContainText('your original files are never moved or changed')
  const chooser = page.waitForEvent('filechooser')
  await dialog.getByRole('button', { name: 'Choose files…' }).click()
  await (await chooser).setFiles([
    { name: '02 harbour.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: await docx('The harbour', 'Gulls before the light.') },
    { name: '01 dawn.md', mimeType: 'text/markdown', buffer: Buffer.from('---\ntitle: Dawn\n---\nThe city before dawn.') },
    { name: 'photo.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('x') },
  ])
  const list = dialog.getByLabel('Files to bring in')
  await expect(list).toContainText('2 FILES · 10 WORDS')
  await expect(list.locator('li strong')).toHaveText(['Dawn', 'The harbour'])
  await expect(dialog.getByLabel('Project type')).toHaveValue('book')
  await expect(dialog).toContainText('Each file becomes a chapter.')
  await dialog.getByLabel('Project title').fill('Harbour book')
  await dialog.getByRole('button', { name: 'Bring in' }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByLabel('Title')).toHaveValue('Harbour book')
  await expect(page.getByRole('status').filter({ hasText: 'Brought in' })).toHaveText('Brought in 2 files. The originals were not changed.')
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('yazi-browser-preview-v1')!).projects[0])
  expect(saved.sections.map((s: { kind: string; title: string; body: string }) => [s.kind, s.title, s.body])).toEqual([['chapter', 'Dawn', 'The city before dawn.'], ['chapter', 'The harbour', 'Gulls before the light. **Bold words.**']])

  await page.locator('#writing-library').getByRole('button', { name: 'Bring in writing…' }).click()
  const again = page.waitForEvent('filechooser')
  await dialog.getByRole('button', { name: 'Choose files…' }).click()
  await (await again).setFiles([{ name: 'epilogue.txt', mimeType: 'text/plain', buffer: Buffer.from('After.') }])
  await dialog.getByLabel('Add to “Harbour book”, after its current text').check()
  await dialog.getByRole('button', { name: 'Bring in' }).click()
  await expect(dialog).toHaveCount(0)
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('yazi-browser-preview-v1')!).projects[0].sections.map((s: { title: string }) => s.title))).toEqual(['Dawn', 'The harbour', 'epilogue'])
})
