import { Decoration, EditorView, ViewPlugin } from '@codemirror/view'
import type { DecorationSet, ViewUpdate } from '@codemirror/view'
import type { ProjectCard } from '../shared/types'
import { t } from '../i18n'
import { cardMentions } from './card-mentions'
export function cardLinks(cards: () => ProjectCard[], open: (id: string) => void) {
  function ranges(view: EditorView) {
    return Decoration.set(cardMentions(view.state.doc.toString(), cards()).map(m => Decoration.mark({ class: 'card-mention', attributes: { 'data-card-id': m.id, role: 'link', tabindex: '0', 'aria-label': t('Open card for {name}', { name: m.name }) } }).range(m.from, m.to)), true)
  }
  return [ViewPlugin.fromClass(class {
    decorations: DecorationSet
    constructor(view: EditorView) { this.decorations = ranges(view) }
    update(update: ViewUpdate) { if (update.docChanged || update.viewportChanged) this.decorations = ranges(update.view) }
  }, { decorations: plugin => plugin.decorations }), EditorView.domEventHandlers({
    click: event => { const node = (event.target as HTMLElement).closest<HTMLElement>('[data-card-id]'); if (!node) return false; event.preventDefault(); open(node.dataset.cardId!); return true },
    keydown: event => { const node = (event.target as HTMLElement).closest<HTMLElement>('[data-card-id]'); if (!node || !['Enter', ' '].includes(event.key)) return false; event.preventDefault(); open(node.dataset.cardId!); return true },
  })]
}
