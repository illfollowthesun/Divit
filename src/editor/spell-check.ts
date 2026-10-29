import { EditorView, ViewPlugin, showTooltip } from '@codemirror/view'
import type { ViewUpdate } from '@codemirror/view'
import { StateEffect, StateField } from '@codemirror/state'
import { t } from '../i18n'
import { syntaxTree, ensureSyntaxTree } from '@codemirror/language'
import type { SyntaxNode } from '@lezer/common'
import { suggestions } from '../spell/spell-client'
import { checkIssues, setCheckIssues, ignoreCheckIssue, clearCheckIssues } from './check-issues'
import { ignoredByRule } from '../modes/issues'
import type { IgnoreRule } from '../modes/issues'
import { localChecker } from '../modes/local-checker'
import type { CheckLanguage, Issue } from '../modes/checker'
import { normalize } from '../spell/words'
import type { SpellLanguage } from '../spell/words'

export type Spelling = { language: () => CheckLanguage; accepted: (language: SpellLanguage) => Set<string>; add: (word: string, language: SpellLanguage) => void; ignore: (word: string) => void; error: (message: string) => void; issues: (issues: Issue[], checking: boolean) => void; rules: () => readonly IgnoreRule[] }
type Hit = { id: string; from: number; to: number; word: string; language: SpellLanguage }
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
  if (!view.state.field(checkIssues).issues.some(issue => issue.id === hit.id && issue.from === hit.from && issue.to === hit.to)) return
  if (normalize(view.state.sliceDoc(hit.from, hit.to)) !== hit.word) return
  view.dispatch({ changes: { from: hit.from, to: hit.to, insert: text }, selection: { anchor: hit.from + text.length }, effects: openPopover.of(null), userEvent: 'input.spelling' }); view.focus()
}

const popover = StateField.define<Popover | null>({
  create: () => null,
  update(value, tr) {
    if (tr.effects.some(effect => effect.is(clearCheckIssues))) return null
    for (const effect of tr.effects) if (effect.is(openPopover)) return effect.value
    if (!value || tr.docChanged) return null
    const head = tr.state.selection.main.head
    return head < value.from || head > value.to ? null : value
  },
  provide: field => showTooltip.compute([field], state => {
    const value = state.field(field)
    return value && { pos: value.from, end: value.to, above: true, arrow: false, create: view => {
      const dom = document.createElement('div'); dom.className = 'spell-popover'; dom.setAttribute('role', 'group'); dom.setAttribute('aria-label', t('Spelling suggestions for {word}', { word: value.word }))
      if (!value.options.length) dom.append(t('No suggestions'))
      else { dom.append(`${t('Did you mean:')} `); value.options.forEach((option, i) => { if (i) dom.append(' · '); dom.append(button(option, () => replace(view, value, option))) }) }
      return { dom }
    } }
  }),
})

const activeViews = new WeakSet<EditorView>()
let activeMenu: (() => void) | null = null
const closeMenu = () => activeMenu?.()
async function openMenu(view: EditorView, spelling: Spelling, hit: Hit, x: number, y: number, alive: () => boolean) {
  closeMenu()
  const doc = view.state.doc
  let options: string[] = []
  try { options = await suggestions(hit.language, hit.word) } catch (error) { if (activeViews.has(view) && alive()) spelling.error(failure(error)) }
  if (view.state.doc !== doc || !activeViews.has(view) || !alive() || !view.state.field(checkIssues).issues.some(issue => issue.id === hit.id)) return
  const menu = document.createElement('div'); menu.className = 'spell-menu'; menu.setAttribute('role', 'menu'); menu.setAttribute('aria-label', t('Spelling: {word}', { word: hit.word }))
  const item = (label: string, run: () => void, disabled = false) => { const node = button(label, () => { close(); run() }); node.setAttribute('role', 'menuitem'); node.disabled = disabled; menu.append(node) }
  const separator = () => { const node = document.createElement('div'); node.setAttribute('role', 'separator'); menu.append(node) }
  const clipboard = (action: Promise<unknown>) => { action.catch(() => spelling.error(t('Clipboard access was blocked. Use Ctrl X, Ctrl C or Ctrl V instead.'))) }
  const { from, to } = view.state.selection.main, selected = view.state.sliceDoc(from, to)
  options.forEach(option => item(option, () => replace(view, hit, option)))
  if (!options.length) item(t('No suggestions'), () => {}, true)
  separator()
  item(t('Add to dictionary'), () => spelling.add(hit.word, hit.language))
  item(t('Ignore in this project'), () => spelling.ignore(hit.word))
  separator()
  item(t('Cut'), () => clipboard(navigator.clipboard.writeText(selected).then(() => view.dispatch({ changes: { from, to }, userEvent: 'delete.cut' }))), !selected)
  item(t('Copy'), () => clipboard(navigator.clipboard.writeText(selected)), !selected)
  item(t('Paste'), () => clipboard(navigator.clipboard.readText().then(text => { view.dispatch({ ...view.state.replaceSelection(text), userEvent: 'input.paste', scrollIntoView: true }); view.focus() })))
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
    timer = 0; generation = 0; destroyed = false
    constructor(readonly view: EditorView) { activeViews.add(view); this.schedule() }
    update(update: ViewUpdate) {
      if (update.transactions.some(tr => tr.effects.some(e => e.is(clearCheckIssues)))) closeMenu()
      if (update.docChanged || update.transactions.some(tr => tr.effects.some(e => e.is(refreshSpelling)))) {
        this.schedule()
      } else if (update.transactions.some(tr => tr.effects.some(e => e.is(setCheckIssues) || e.is(ignoreCheckIssue)))) this.report(false)
    }
    report(checking: boolean) {
      queueMicrotask(() => { if (!this.destroyed) spelling.issues(this.view.state.field(checkIssues).issues, checking) })
    }
    schedule() {
      clearTimeout(this.timer)
      const generation = ++this.generation, doc = this.view.state.doc, language = spelling.language()
      // Notify React outside CodeMirror's update, including on initial creation.
      this.report(true)
      this.timer = window.setTimeout(() => {
        const tree = ensureSyntaxTree(this.view.state, doc.length, 100) ?? syntaxTree(this.view.state)
        const prose = (from: number) => {
          for (let node: SyntaxNode | null = tree.resolveInner(from, 1); node; node = node.parent) if (skipped.has(node.name)) return false
          return true
        }
        void localChecker.check({ text: doc.toString(), language, accepted: spelling.accepted, prose }).then(issues => {
          if (this.destroyed || generation !== this.generation || doc !== this.view.state.doc || language !== spelling.language()) return
          this.view.dispatch({ effects: setCheckIssues.of(issues.filter(issue => !ignoredByRule(issue, spelling.rules())).map(issue => ({ ...issue, id: issue.id + ':' + generation }))) })
        }).catch(error => { if (!this.destroyed && generation === this.generation) { spelling.issues([], false); spelling.error(failure(error)) } })
      }, 200)
    }
    destroy() { activeViews.delete(this.view); this.destroyed = true; ++this.generation; clearTimeout(this.timer); closeMenu() }
  })

  function wordAt(view: EditorView, pos: number): Hit | null {
    let hit: Hit | null = null
    const issue = view.state.field(checkIssues).issues.find(issue => issue.from <= pos && pos <= issue.to)
    if (issue) hit = { id: issue.id, from: issue.from, to: issue.to, word: normalize(issue.original), language: issue.language }
    return hit
  }
  return [plugin, popover, EditorView.domEventHandlers({
    click: (event, view) => {
      const doc = view.state.doc
      const { main } = view.state.selection
      const hit = (event.target as HTMLElement).closest('.cm-misspelled') && main.empty ? wordAt(view, main.head) : null
      if (hit) void suggestions(hit.language, hit.word).then(options => { if (activeViews.has(view) && view.plugin(plugin) && view.state.doc === doc && normalize(view.state.sliceDoc(hit.from, hit.to)) === hit.word) view.dispatch({ effects: openPopover.of({ ...hit, options }) }) }).catch(error => { if (activeViews.has(view) && view.plugin(plugin)) spelling.error(failure(error)) })
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
      void openMenu(view, spelling, hit, caret?.left ?? event.clientX, caret?.bottom ?? event.clientY, () => !!view.plugin(plugin))
      return true
    },
  })]
}
