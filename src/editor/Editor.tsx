import { useEffect, useRef } from 'react'
import { EditorView, keymap, placeholder } from '@codemirror/view'
import type { ViewUpdate } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'

function centerCaret(view: EditorView) {
  view.requestMeasure({
    read: current => {
      const paper = current.dom.closest<HTMLElement>('.paper')
      const caret = current.coordsAtPos(current.state.selection.main.head)
      return paper && caret ? { paper, offset: caret.top - paper.getBoundingClientRect().top - paper.clientHeight * 0.45 } : null
    },
    write: measure => { if (measure && Math.abs(measure.offset) > 2) measure.paper.scrollTop += measure.offset },
  })
}

export function Editor({ id, body, onChange, onReady, typewriter = false }: { id: string; body: string; onChange: (text: string) => void; onReady: (view: EditorView | null) => void; typewriter?: boolean }) {
  const element = useRef<HTMLDivElement>(null)
  const changed = useRef(onChange); changed.current = onChange
  const ready = useRef(onReady); ready.current = onReady
  const typewriterRef = useRef(typewriter); typewriterRef.current = typewriter
  const editor = useRef<EditorView | null>(null)
  // Each draft owns its undo history. Only a draft switch recreates the editor.
  const initial = useRef(body); initial.current = body
  useEffect(() => {
    if (!element.current) return
    const view = new EditorView({ parent: element.current, state: EditorState.create({ doc: initial.current, extensions: [
      history(), keymap.of([...defaultKeymap, ...historyKeymap]), markdown(), syntaxHighlighting(defaultHighlightStyle),
      EditorView.lineWrapping, placeholder('Begin anywhere. The first sentence can change.'),
      EditorView.contentAttributes.of({ 'aria-label': 'Markdown text', spellcheck: 'true' }),
      EditorView.updateListener.of((update: ViewUpdate) => {
        if (update.docChanged) changed.current(update.state.doc.toString())
        if (typewriterRef.current && (update.docChanged || update.selectionSet || update.focusChanged)) centerCaret(update.view)
      }),
    ] }) }); editor.current = view; ready.current(view)
    if (typewriterRef.current) centerCaret(view)
    return () => { editor.current = null; ready.current(null); view.destroy() }
  }, [id])
  useEffect(() => { if (typewriter && editor.current) { editor.current.focus(); centerCaret(editor.current) } }, [typewriter])
  return <div ref={element} className="markdown-editor" />
}
