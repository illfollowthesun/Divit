import { useEffect, useRef } from 'react'
import { EditorView, keymap, placeholder } from '@codemirror/view'
import type { ViewUpdate } from '@codemirror/view'
import { Compartment, EditorState } from '@codemirror/state'
import type { ProjectCard } from '../shared/types'
import { cardLinks } from './card-links'
import { spellCheck, refreshSpelling } from './spell-check'
import { acceptedWords } from '../spell/words'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'

// Native squiggles cannot be read or offered as suggestions, so Yazı checks spelling itself.
const attributes = (language: string) => EditorView.contentAttributes.of({ 'aria-label': 'Markdown text', spellcheck: 'false', lang: language, autocorrect: 'off', autocapitalize: 'off' })

function centerCaret(view: EditorView) {
  view.requestMeasure({
    read: current => {
      const paper = current.dom.closest<HTMLElement>('.paper')
      const caret = current.coordsAtPos(current.state.selection.main.head)
      if (!paper || !caret) return null
      const offset = caret.top - paper.getBoundingClientRect().top - paper.clientHeight * 0.45
      return { paper, offset, extra: Math.max(0, -paper.scrollTop - offset), leading: parseFloat(paper.style.getPropertyValue('--typewriter-leading')) || 0 }
    },
    write: measure => {
      if (!measure) return
      if (measure.extra > 2) { measure.paper.style.setProperty('--typewriter-leading', `${measure.leading + measure.extra}px`); centerCaret(view) }
      else if (Math.abs(measure.offset) > 2) measure.paper.scrollTop += measure.offset
    },
  })
}

export function Editor({ id, body, onChange, onReady, typewriter = false, cards, onCardOpen, language = 'en', dictionary, ignored, onAddWord, onIgnoreWord, onSpellError }: { id: string; body: string; onChange: (text: string) => void; onReady: (view: EditorView | null) => void; typewriter?: boolean; cards?: ProjectCard[]; onCardOpen?: (id: string) => void; language?: 'en' | 'tr'; dictionary?: string[]; ignored?: string[]; onAddWord?: (word: string) => void; onIgnoreWord?: (word: string) => void; onSpellError?: (message: string) => void }) {
  const element = useRef<HTMLDivElement>(null)
  const changed = useRef(onChange); changed.current = onChange
  const ready = useRef(onReady); ready.current = onReady
  const typewriterRef = useRef(typewriter); typewriterRef.current = typewriter
  const editor = useRef<EditorView | null>(null)
  const cardConfig = useRef(new Compartment()), cardsRef = useRef(cards), cardOpen = useRef(onCardOpen)
  const languageConfig = useRef(new Compartment())
  cardsRef.current = cards; cardOpen.current = onCardOpen
  const spelling = useRef({ language, accepted: new Set<string>(), add: onAddWord, ignore: onIgnoreWord, error: onSpellError })
  spelling.current = { language, accepted: acceptedWords(language, dictionary, ignored, (cards ?? []).filter(c => !c.trashedAt).flatMap(c => [c.name, ...c.aliases])), add: onAddWord, ignore: onIgnoreWord, error: onSpellError }
  // Each draft owns its undo history. Only a draft switch recreates the editor.
  const initial = useRef(body); initial.current = body
  useEffect(() => {
    if (!element.current) return
    const view = new EditorView({ parent: element.current, state: EditorState.create({ doc: initial.current, extensions: [
      history(), keymap.of([...defaultKeymap, ...historyKeymap]), markdown(), syntaxHighlighting(defaultHighlightStyle),
      EditorView.lineWrapping, placeholder('Begin anywhere. The first sentence can change.'),
      cardConfig.current.of(cardLinks(() => cardsRef.current ?? [], id => cardOpen.current?.(id))),
      languageConfig.current.of(attributes(language)),
      spellCheck({ language: () => spelling.current.language, accepted: () => spelling.current.accepted, add: word => spelling.current.add?.(word), ignore: word => spelling.current.ignore?.(word), error: message => spelling.current.error?.(message) }),
      EditorView.updateListener.of((update: ViewUpdate) => {
        if (update.docChanged) changed.current(update.state.doc.toString())
        if (typewriterRef.current && (update.docChanged || update.selectionSet || update.focusChanged)) centerCaret(update.view)
      }),
    ] }) }); editor.current = view; ready.current(view)
    if (typewriterRef.current) centerCaret(view)
    return () => { editor.current = null; ready.current(null); view.destroy() }
  }, [id])
  useEffect(() => { editor.current?.dispatch({ effects: languageConfig.current.reconfigure(attributes(language)) }) }, [language])
  useEffect(() => { editor.current?.dispatch({ effects: refreshSpelling.of(null) }) }, [language, dictionary, ignored, cards])
  useEffect(() => { editor.current?.dispatch({ effects: cardConfig.current.reconfigure(cardLinks(() => cardsRef.current ?? [], id => cardOpen.current?.(id))) }) }, [cards])
  useEffect(() => {
    const view = editor.current
    if (!view) return
    view.dom.closest<HTMLElement>('.paper')?.style.removeProperty('--typewriter-leading')
    if (typewriter) { view.focus(); centerCaret(view) }
  }, [typewriter, id])
  return <div ref={element} className="markdown-editor" />
}
