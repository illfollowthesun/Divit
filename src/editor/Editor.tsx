import { useEffect, useRef } from 'react'
import { EditorView, keymap, placeholder } from '@codemirror/view'
import type { ViewUpdate } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle } from '@codemirror/language'

export function Editor({ id, body, onChange, onReady }: { id: string; body: string; onChange: (text: string) => void; onReady: (view: EditorView | null) => void }) {
  const element = useRef<HTMLDivElement>(null)
  const changed = useRef(onChange); changed.current = onChange
  const ready = useRef(onReady); ready.current = onReady
  // Each draft owns its undo history. Only a draft switch recreates the editor.
  const initial = useRef(body); initial.current = body
  useEffect(() => {
    if (!element.current) return
    const view = new EditorView({ parent: element.current, state: EditorState.create({ doc: initial.current, extensions: [
      history(), keymap.of([...defaultKeymap, ...historyKeymap]), markdown(), syntaxHighlighting(defaultHighlightStyle),
      EditorView.lineWrapping, placeholder('Begin anywhere. The first sentence can change.'),
      EditorView.contentAttributes.of({ 'aria-label': 'Markdown text', spellcheck: 'true' }),
      EditorView.updateListener.of((update: ViewUpdate) => { if (update.docChanged) changed.current(update.state.doc.toString()) }),
    ] }) }); ready.current(view)
    return () => { ready.current(null); view.destroy() }
  }, [id])
  return <div ref={element} className="markdown-editor" />
}
