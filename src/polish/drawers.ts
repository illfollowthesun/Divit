import { useEffect, useState } from 'react'
import type { KeyboardEvent } from 'react'
export function useCompactWidth(width: number) {
  const [compact, setCompact] = useState(() => matchMedia(`(max-width: ${width}px)`).matches)
  useEffect(() => { const query = matchMedia(`(max-width: ${width}px)`); const update = () => setCompact(query.matches); query.addEventListener('change', update); update(); return () => query.removeEventListener('change', update) }, [width])
  return compact
}
export function trapDrawer(event: KeyboardEvent<HTMLElement>, active: boolean) {
  if (!active || event.key !== 'Tab') return
  const nodes = [...event.currentTarget.querySelectorAll<HTMLElement>('button:not(:disabled),input:not(:disabled),textarea:not(:disabled),select:not(:disabled),a[href],[tabindex="0"]')].filter(el => el.getClientRects().length)
  const first = nodes[0], last = nodes[nodes.length - 1]
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
}
