import { Decoration, EditorView, ViewPlugin, showTooltip } from '@codemirror/view'
import type { DecorationSet, ViewUpdate } from '@codemirror/view'
import { StateEffect, StateField } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import type { SyntaxNode } from '@lezer/common'
import { checkWords, suggestions, verdict } from '../spell/spell-client'
import { misspelled, normalize, spellWords } from '../spell/words'
import type { SpellLanguage } from '../spell/words'

export type Spelling = { language: () => SpellLanguage; accepted: () => Set<string>; add: (word: string) => void; ignore: (word: string) => void; error: (message: string) => void }
type Hit = { from: number; to: number; word: string }
type Popover = Hit & { options: string[] }

export const refreshSpelling = StateEffect.define<null>()
const openPopover = StateEffect.define<Popover | null>()
// Links, code, HTML and images are not prose.
const skipped = new Set(['URL', 'InlineCode', 'FencedCode', 'CodeBlock', 'CodeText', 'HTMLTag', 'HTMLBlock', 'Autolink', 'Image', 'CommentBlock'])
const failure = (error: unknown) => error instanceof Error ? error.message : String(error)

function button(label: string, run: () => void) {
  const node = document.createElement('button'); node.type = 'button'; node.textContent = label
  node.addEventListener('mousedown', event => event.preventDefault()); node.addEventListener('click', run)
  return node
}
// Only ever replaces on an explicit choice, and only if the word is still there.
function replace(view: EditorView, hit: Hit, text: string) {
  if (normalize(view.state.sliceDoc(hit.from, hit.to)) !== hit.word) return
  view.dispatch({ changes: { from: hit.from, to: hit.to, insert: text }, selection: { anchor: hit.from + text.length }, effects: openPopover.of(null), userEvent: 'input.spelling' }); view.focus()
}

const popover = StateField.define<Popover | null>({
  create: () => null,
  update(value, tr) {
    for (const effect of tr.effects) if (effect.is(openPopover)) return effect.value
    if (!value || tr.docChanged) return null
    const head = tr.state.selection.main.head
    return head < value.from || head > value.to ? null : value
  },
  provide: field => showTooltip.compute([field], state => {
    const value = state.field(field)
    return value && { pos: value.from, end: value.to, above: true, arrow: false, create: view => {
      const dom = document.createElement('div'); dom.className = 'spell-popover'; dom.setAttribute('role', 'group'); dom.setAttribute('aria-label', `Spelling suggestions for ${value.word}`)
      if (!value.options.length) dom.append('No suggestions')
      else { dom.append('Did you mean: '); value.options.forEach((option, i) => { if (i) dom.append(' · '); dom.append(button(option, () => replace(view, value, option))) }) }
      return { dom }
    } }
  }),
})

let activeMenu: (() => void) | null = null
const closeMenu = () => activeMenu?.()
async function openMenu(view: EditorView, spelling: Spelling, hit: Hit, x: number, y: number) {
  closeMenu()
  let options: string[] = []
  try { options = await suggestions(spelling.language(), hit.word) } catch (error) { spelling.error(failure(error)) }
  const menu = document.createElement('div'); menu.className = 'spell-menu'; menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', `Spelling: ${hit.word}`)
  const item = (label: string, run: () => void, disabled = false) => { const node = button(label, () => { close(); run() }); node.setAttribute('role', 'menuitem'); node.disabled = disabled; menu.append(node) }
  const separator = () => { const node = document.createElement('div'); node.setAttribute('role', 'separator'); menu.append(node) }
  const clipboard = (action: Promise<unknown>) => { action.catch(() => spelling.error('Clipboard access was blocked. Use Ctrl X, Ctrl C or Ctrl V instead.')) }
  const { from, to } = view.state.selection.main, selected = view.state.sliceDoc(from, to)
  options.forEach(option => item(option, () => replace(view, hit, option)))
  if (!options.length) item('No suggestions', () => {}, true)
  separator()
  item('Add to dictionary', () => spelling.add(hit.word))
  item('Ignore in this project', () => spelling.ignore(hit.word))
  separator()
  item('Cut', () => clipboard(navigator.clipboard.writeText(selected).then(() => view.dispatch({ changes: { from, to }, userEvent: 'delete.cut' }))), !selected)
  item('Copy', () => clipboard(navigator.clipboard.writeText(selected)), !selected)
  item('Paste', () => clipboard(navigator.clipboard.readText().then(text => { view.dispatch({ ...view.state.replaceSelection(text), userEvent: 'input.paste', scrollIntoView: true }); view.focus() })))
  const items = () => [...menu.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')]
  menu.addEventListener('keydown', event => {
    const list = items(), index = list.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); list[(index + (event.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length]?.focus() }
    else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); list[event.key === 'Home' ? 0 : list.length - 1]?.focus() }
    else if (event.key === 'Escape' || event.key === 'Tab') { event.preventDefault(); event.stopPropagation(); close(); view.focus() }
  })
  const outside = (event: Event) => { if (!menu.contains(event.target as Node)) close() }
  function close() {
    menu.remove(); activeMenu = null
    document.removeEventListener('pointerdown', outside, true); window.removeEventListener('blur', close); window.removeEventListener('resize', close); document.removeEventListener('scroll', close, true)
  }
  document.body.append(menu); activeMenu = close
  const box = menu.getBoundingClientRect()
  menu.style.left = `${Math.max(8, Math.min(x, innerWidth - box.width - 8))}px`
  menu.style.top = `${y + box.height > innerHeight - 8 ? Math.max(8, y - box.height) : y}px`
  document.addEventListener('pointerdown', outside, true); window.addEventListener('blur', close); window.addEventListener('resize', close); document.addEventListener('scroll', close, true)
  items()[0]?.focus()
}

export function spellCheck(spelling: Spelling) {
  const plugin = ViewPlugin.fromClass(class {
    decorations: DecorationSet
    timer = 0; typing = false; failed = false; destroyed = false
    constructor(readonly view: EditorView) { this.decorations = this.build() }
    update(update: ViewUpdate) {
      if (update.docChanged) this.typing = update.transactions.some(tr => tr.isUserEvent('input.type'))
      else if (update.selectionSet) this.typing = false
      if (update.docChanged || update.viewportChanged || update.selectionSet || update.focusChanged || update.transactions.some(tr => tr.effects.some(e => e.is(refreshSpelling)))) this.decorations = this.build()
    }
    build() {
      const { view } = this, language = spelling.language(), accepted = spelling.accepted(), tree = syntaxTree(view.state), head = view.state.selection.main.head
      const check = (word: string) => verdict(language, word), marks = [], unknown: string[] = []
      for (const { from, to } of view.visibleRanges) for (const word of spellWords(view.state.sliceDoc(from, to), from)) {
        if (this.typing && head === word.to) continue // Wait until the word is finished.
        let prose = true
        for (let node: SyntaxNode | null = tree.resolveInner(word.from, 1); node; node = node.parent) if (skipped.has(node.name)) { prose = false; break }
        if (!prose) continue
        for (const part of new Set([word.word, word.stem])) if (check(part) === undefined) unknown.push(part)
        if (misspelled(word, language, accepted, check)) marks.push(Decoration.mark({ class: 'cm-misspelled', word: word.word }).range(word.from, word.to))
      }
      if (unknown.length && !this.failed) this.request(language, unknown)
      return Decoration.set(marks, true)
    }
    request(language: SpellLanguage, words: string[]) {
      clearTimeout(this.timer)
      this.timer = window.setTimeout(() => {
        void checkWords(language, words).then(changed => { if (changed && !this.destroyed) this.view.dispatch({ effects: refreshSpelling.of(null) }) })
          .catch(error => { this.failed = true; spelling.error(failure(error)) })
      }, 200)
    }
    destroy() { this.destroyed = true; clearTimeout(this.timer); closeMenu() }
  }, { decorations: value => value.decorations })

  function wordAt(view: EditorView, pos: number): Hit | null {
    let hit: Hit | null = null
    view.plugin(plugin)?.decorations.between(pos, pos, (from, to, mark) => { hit = { from, to, word: mark.spec.word } })
    return hit
  }
  return [plugin, popover, EditorView.domEventHandlers({
    click: (event, view) => {
      const { main } = view.state.selection
      const hit = (event.target as HTMLElement).closest('.cm-misspelled') && main.empty ? wordAt(view, main.head) : null
      if (hit) void suggestions(spelling.language(), hit.word).then(options => { if (normalize(view.state.sliceDoc(hit.from, hit.to)) === hit.word) view.dispatch({ effects: openPopover.of({ ...hit, options }) }) }).catch(error => spelling.error(failure(error)))
      return false
    },
    keydown: (event, view) => {
      if (event.key !== 'Escape' || !view.state.field(popover, false)) return false
      // Esc closes only the popover; it must not also leave focus mode.
      event.preventDefault(); event.stopPropagation(); view.dispatch({ effects: openPopover.of(null) }); return true
    },
    contextmenu: (event, view) => {
      // The menu key and Shift F10 target the editor itself; a mouse targets the text under the pointer.
      const keyboard = event.target === view.contentDOM, head = view.state.selection.main.head
      const pos = (event.target as HTMLElement).closest('.cm-misspelled') ? view.posAtCoords({ x: event.clientX, y: event.clientY }) : keyboard ? head : null
      const hit = pos === null ? null : wordAt(view, pos)
      if (!hit) return false // Everywhere else the normal menu appears.
      event.preventDefault()
      const caret = keyboard ? view.coordsAtPos(hit.to) : null
      void openMenu(view, spelling, hit, caret?.left ?? event.clientX, caret?.bottom ?? event.clientY)
      return true
    },
  })]
}
