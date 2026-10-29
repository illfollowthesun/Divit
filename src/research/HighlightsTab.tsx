import type { Research, ResearchSource } from '../shared/types'

// Every highlight for this piece, grouped by source, each with its note.
export function HighlightsTab({ research, open, insert, insertAs, setInsertAs }: { research: Research; open: (sourceId: string, highlightId: string) => void; insert: (quote: string, source: ResearchSource, highlightId: string) => void; insertAs: 'quote' | 'footnote'; setInsertAs: (value: 'quote' | 'footnote') => void }) {
  const groups = research.sources.map(source => ({ source, highlights: research.highlights.filter(h => h.sourceId === source.id).sort((a, b) => a.from - b.from) })).filter(group => group.highlights.length)
  return <div className="highlights-tab">
    <label className="insert-as">Insert as<select value={insertAs} onChange={event => setInsertAs(event.target.value as 'quote' | 'footnote')}><option value="quote">Quote block</option><option value="footnote">Footnote</option></select></label>
    {!groups.length && <p className="quiet research-empty">Select words in a source to highlight them. They gather here, with your notes.</p>}
    {groups.map(({ source, highlights }) => <section key={source.id} className="highlight-group" aria-label={source.title}>
      <h4>{source.title}{source.site && <small> · {source.site}</small>}</h4>
      {highlights.map(h => <article key={h.id} className={`highlight-item hl-edge-${h.color}`}>
        <blockquote>{h.quote}</blockquote>{h.note && <p className="highlight-item-note">{h.note}</p>}
        <div className="highlight-actions"><button className="popover-text" onClick={() => open(source.id, h.id)}>Open in source</button><button className="popover-text" onClick={() => insert(h.quote, source, h.id)} aria-label={`Insert quote: ${h.quote.slice(0, 40)}`}>Insert</button></div>
      </article>)}
    </section>)}
  </div>
}
