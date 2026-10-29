import test from 'node:test'
import assert from 'node:assert/strict'
import { fromMarkdown, importedProject, addImported } from '../src/projects/import.ts'
test('imported Markdown keeps its text; the title comes from front matter, a heading or the file name', () => {
  assert.deepEqual(fromMarkdown('01 - the-last ferry.md', '# The Last Ferry\n\nThe gulls arrived.\r\n\r\n\r\nLight.'), { name: '01 - the-last ferry.md', title: 'The Last Ferry', body: 'The gulls arrived.\n\nLight.', images: 0 })
  assert.equal(fromMarkdown('notes.md', '---\ntitle: "Kış"\ndate: 2026\n---\n# Kış\nMetin').body, 'Metin')
  assert.equal(fromMarkdown('notes.md', '---\ntitle: Kış\n---\n# Another\nMetin').body, '# Another\nMetin')
  assert.equal(fromMarkdown('02_karakoy_at_dawn.txt', 'Plain text').title, 'karakoy at dawn')
})
test('files become a blog body, story scenes or book chapters, and are added after existing writing', () => {
  const texts = [fromMarkdown('a.md', '# One\nFirst'), fromMarkdown('b.md', '# Two\nSecond')]
  assert.equal(importedProject(texts, 'blog', '').body, '## One\n\nFirst\n\n## Two\n\nSecond')
  assert.equal(importedProject(texts.slice(0, 1), 'blog', '').title, 'One')
  const book = importedProject(texts, 'book', 'My book')
  assert.deepEqual([book.title, book.sections.map(s => [s.kind, s.title, s.body, s.parentId])], ['My book', [['chapter', 'One', 'First', undefined], ['chapter', 'Two', 'Second', undefined]]])
  assert.deepEqual(importedProject(texts, 'story', '').sections.map(s => s.kind), ['scene', 'scene'])
  const story = { ...importedProject(texts.slice(0, 1), 'story', 'S') }
  assert.deepEqual(addImported(story, texts.slice(1)).sections.map(s => s.title), ['One', 'Two'])
  assert.equal(addImported({ ...importedProject([], 'blog', 'Post'), body: 'Mine.' }, texts.slice(0, 1)).body, 'Mine.\n\nFirst')
})
