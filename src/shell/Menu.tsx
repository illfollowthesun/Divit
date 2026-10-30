import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'

// A small button menu (the toolbar's More, the New writing split button). Opens on click or Enter,
// moves with the arrow keys, closes on Esc, Tab, a choice or a click elsewhere. No hover-only parts.
export type MenuItem = { label: string; onSelect: () => void; disabled?: boolean; checked?: boolean; hint?: string }
export function Menu({ label, items, children, className = '', title }: { label: string; items: MenuItem[]; children: ReactNode; className?: string; title?: string }) {
  const [open, setOpen] = useState(false)
  const root = useRef<HTMLDivElement>(null), button = useRef<HTMLButtonElement>(null)
  const entries = () => [...root.current?.querySelectorAll<HTMLElement>('[role^=menuitem]:not(:disabled)') ?? []]
  useEffect(() => {
    if (!open) return
    entries()[0]?.focus()
    const outside = (event: PointerEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false) }
    document.addEventListener('pointerdown', outside)
    return () => document.removeEventListener('pointerdown', outside)
  }, [open])
  function keys(event: React.KeyboardEvent) {
    if (!open) return
    const list = entries(), at = list.indexOf(document.activeElement as HTMLElement)
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); setOpen(false); button.current?.focus() }
    else if (event.key === 'Tab') setOpen(false)
    else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); list[(at + (event.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length]?.focus() }
    else if (event.key === 'Home' || event.key === 'End') { event.preventDefault(); list[event.key === 'Home' ? 0 : list.length - 1]?.focus() }
  }
  return <div className={`menu ${className}`} ref={root} onKeyDown={keys}>
    <button ref={button} type="button" aria-haspopup="menu" aria-expanded={open} aria-label={label} title={title} onClick={() => setOpen(value => !value)}>{children}</button>
    {open && <div className="menu-list" role="menu" aria-label={label}>{items.map(item => <button key={item.label} type="button" role={item.checked === undefined ? 'menuitem' : 'menuitemcheckbox'} aria-checked={item.checked} disabled={item.disabled} onClick={() => { setOpen(false); item.onSelect() }}>
      <span className="menu-check" aria-hidden="true">{item.checked ? '✓' : ''}</span><span className="menu-label">{item.label}</span>{item.hint && <kbd>{item.hint}</kbd>}</button>)}</div>}
  </div>
}
