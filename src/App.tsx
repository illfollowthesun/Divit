import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import type { EditorView } from '@codemirror/view'
import { useCompactWidth, trapDrawer } from './polish/drawers'
import { BackupSettings } from './settings/BackupSettings'
import { AiSettings } from './settings/AiSettings'
import { checkForUpdate } from './settings/updates'
import { issueUrl, systemInfo } from './settings/feedback'
import type { AvailableUpdate } from './settings/updates'
import { useResearch } from './research/useResearch'
import { ResearchDrawer, newInboxCount } from './research/ResearchDrawer'
import type { InsertQuote } from './research/ResearchDrawer'
import { footnote, nextFootnote, quoteBlock } from './research/citation'
import { Editor } from './editor/Editor'
import { Preview } from './editor/Preview'
import { api, desktop } from './shared/api'
import { Notebook } from './projects/Notebook'
import { addSection } from './projects/manuscript'
import { recordWriting, localDay } from './projects/writing-log'
import { ExportPanel } from './projects/ExportPanel'
import { Snapshots } from './projects/SnapshotDialog'
import { takeSnapshot, restoreSnapshot } from './projects/snapshots'
import { Cards } from './projects/Cards'
import { Outline } from './projects/Outline'
import { acceptCheckIssue, currentIssue, ignoreCheckIssue } from './editor/check-issues'
import { ruleFor } from './modes/issues'
import { ReviewPanel } from './modes/ReviewPanel'
import type { Issue } from './modes/checker'
import { modes, modeNames, startMode, underlinesShown, shortcutMode } from './modes/mode'
import type { WritingMode } from './shared/types'
import './modes/modes.css'
import { DraftSession } from './shared/draft-session'
import { newProject, slugify, stages, words } from './shared/types'
import type { Idea, ImageRecord, Library, Project, PublishPlan, Settings, ProjectType, ExportResult, BackupInfo } from './shared/types'

type Room = 'write' | 'ideas' | 'images' | 'trash'
type DialogName = 'help' | 'settings' | 'publish' | 'new-project' | 'snapshots' | 'export' | 'backup-close' | null
const imageText = (p: Project) => [p.body, ...(p.sections ?? []).map(n => n.body), ...(p.snapshots ?? []).flatMap(s => [s.body, ...s.sections.map(n => n.body)])].join('\n')
const message = (e: unknown) => e instanceof Error ? e.message : String(e)

function Modal({ title, children, close, error }: { title: string; children: ReactNode; close: () => void; error?: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const element = dialog.current!; const previous = document.activeElement as HTMLElement | null
    element.showModal(); return () => { element.close(); previous?.focus() }
  }, [])
  return <dialog ref={dialog} onCancel={e => { e.preventDefault(); close() }} onClick={e => { if (e.target === e.currentTarget) close() }} aria-labelledby="dialog-title"><div className="dialog-head"><h2 id="dialog-title">{title}</h2><button onClick={close} aria-label="Close dialog">×</button></div>{error && <p className="modal-error" role="alert">{error}</p>}{children}</dialog>
}
function ImageTile({ image, insert, remove }: { image: ImageRecord; insert?: () => void; remove?: () => void }) {
  const [src, setSrc] = useState('')
  useEffect(() => { let active = true; void api.imageData(image).then(src => { if (active) setSrc(src) }).catch(() => {}); return () => { active = false } }, [image])
  return <div className="image-tile">{src ? <img src={src} alt={image.name} /> : <div className="image-placeholder">Loading image…</div>}<span title={image.name}>{image.name}</span><div className="image-actions">{insert && <button onClick={insert}>Insert in text</button>}{remove && <button onClick={remove} aria-label={`Move ${image.name} to trash`}>Move to trash</button>}</div></div>
}

export function App() {
  const compactRight = useCompactWidth(1100), compactLeft = useCompactWidth(900)
  const [rightOpen, setRightOpen] = useState(false), [leftOpen, setLeftOpen] = useState(false)
  const rightToggle = useRef<HTMLButtonElement>(null), leftToggle = useRef<HTMLButtonElement>(null)
  const rightPanel = useRef<HTMLElement>(null), leftPanel = useRef<HTMLElement>(null)
  function closeDrawer(side: 'left' | 'right') { if (side === 'left') { setLeftOpen(false); leftToggle.current?.focus() } else { setRightOpen(false); rightToggle.current?.focus() } }
  useEffect(() => { if (rightOpen && compactRight) rightPanel.current?.querySelector<HTMLButtonElement>('button')?.focus(); if (leftOpen && compactLeft) leftPanel.current?.querySelector<HTMLButtonElement>('button')?.focus() }, [rightOpen, leftOpen, compactRight, compactLeft])
  const [backupInfo, setBackupInfo] = useState<BackupInfo | null>(null)
  const [update, setUpdate] = useState<AvailableUpdate | null>(null), [updateNote, setUpdateNote] = useState(''), [installing, setInstalling] = useState(false)
  const closeWithoutBackup = useRef<(() => Promise<void>) | null>(null)
  const [lib, setLib] = useState<Library | null>(null)
  const [draft, setDraft] = useState<Project | null>(null)
  const [room, setRoom] = useState<Room>('write')
  const [filter, setFilter] = useState<'all' | 'draft' | 'published'>('all')
  const [tab, setTab] = useState<'Preview' | 'Check' | 'Images' | 'Cards' | 'Notes'>('Preview')
  const [dialog, setDialog] = useState<DialogName>(null)
  const [typewriter, setTypewriter] = useState(false)
  const [chromeVisible, setChromeVisible] = useState(false)
  const [focus, setFocus] = useState(false)
  const [error, setError] = useState('')
  const [status, setStatus] = useState('All changes saved')
  const [busy, setBusy] = useState(false)
  const [capture, setCapture] = useState('')
  const [search, setSearch] = useState('')
  const [tag, setTag] = useState('')
  const [plan, setPlan] = useState<PublishPlan | null>(null)
  const [settings, setSettings] = useState<Settings | null>(null)
  const [acknowledged, setAcknowledged] = useState(false)
  const [tagText, setTagText] = useState('')
  const [exportResult, setExportResult] = useState<ExportResult | null>(null)
  const [editorEpoch, setEditorEpoch] = useState(0)
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null)
  const [sectionId, setSectionId] = useState<string | null>(null)
  const [projectType, setProjectType] = useState<ProjectType>('story')
  const [projectTitle, setProjectTitle] = useState('')
  const session = useRef<DraftSession | null>(null)
  if (!session.current) session.current = new DraftSession(api.saveProject, {
    changed: (project, status) => { setDraft(project); setStatus(status) },
    saved: project => setLib(old => old ? { ...old, projects: [...old.projects.filter(p => p.id !== project.id), project] } : old),
    failed: error => setError(message(error)),
  })
  const view = useRef<EditorView | null>(null)
  const [issues, setIssues] = useState<Issue[]>([])
  const [checking, setChecking] = useState(false)
  const mode = startMode(draft, lib?.settings ?? {})
  const modeRef = useRef(mode); modeRef.current = mode
  const writing = mode === 'write' && !!draft
  const research = useResearch(draft?.id ?? null, setError, writing)
  const [researchOpen, setResearchOpen] = useState(false)
  const researchToggle = useRef<HTMLButtonElement>(null)
  function closeResearch() { setResearchOpen(false); researchToggle.current?.focus() }
  // Research notes used to live in the Notebook. Copy them once into the project's research; the
  // originals stay in the project file untouched.
  const migrated = useRef('')
  useEffect(() => {
    const project = session.current?.project
    if (writing || !research.research || !project || migrated.current === project.id) return
    migrated.current = project.id
    const done = new Set(research.research.notes.map(n => n.migratedFrom)), now = new Date().toISOString()
    const missing = (project.notes ?? []).filter(n => n.kind === 'research' && !done.has(n.id))
    if (missing.length) void research.saveAnnotations(current => ({ notes: [...current.notes, ...missing.map(n => ({ id: crypto.randomUUID(), title: n.title, body: n.body, migratedFrom: n.id, createdAt: now, updatedAt: now, ...(n.trashedAt ? { trashedAt: n.trashedAt } : {}) }))] })).catch(error => { migrated.current = ''; setError(message(error)) })
  }, [research.research, research.saveAnnotations, writing])
  const insertQuote: InsertQuote = (kind, quote, source) => {
    const editor = view.current
    if (!editor) return false
    const range = editor.state.selection.main, doc = editor.state.doc
    if (kind === 'quote') {
      const text = `\n\n${quoteBlock(quote, source)}\n\n`
      editor.dispatch({ changes: { from: range.from, to: range.to, insert: text }, selection: { anchor: range.from + text.length }, scrollIntoView: true })
    } else {
      const note = footnote(quote, source, nextFootnote(doc.toString()))
      editor.dispatch({ changes: [{ from: range.from, to: range.to, insert: note.inline }, { from: doc.length, insert: `${doc.length ? '\n\n' : ''}${note.note}` }], selection: { anchor: range.from + note.inline.length }, scrollIntoView: true })
    }
    return true
  }
  const mounted = useRef(true)
  const captureInput = useRef<HTMLInputElement>(null)

  const select = useCallback((project: Project | null) => {
    session.current!.select(project); setEditorEpoch(n => n + 1); setSectionId(null); setTab('Preview'); setTagText(project?.tags.join(', ') ?? '')
  }, [])
  const refresh = useCallback(async () => { const library = await api.library(); setLib(library); return library }, [])
  useEffect(() => {
    mounted.current = true
    void refresh().then(data => { if (mounted.current) { const sorted = [...data.projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)); select(sorted[0] ?? null) } }).catch(e => setError(message(e)))
    return () => { mounted.current = false }
  }, [refresh, select])
  useEffect(() => { document.documentElement.dataset.theme = lib?.settings.theme ?? 'light' }, [lib?.settings.theme])
  // One quiet check per launch; offline or GitHub trouble is not worth an error.
  const updatesOn = !!lib && lib.settings.checkUpdates !== false
  useEffect(() => { if (updatesOn && !import.meta.env.DEV) void checkForUpdate().then(setUpdate).catch(() => {}) }, [updatesOn])
  async function checkUpdatesNow() {
    setUpdateNote('Checking…')
    try { const found = await checkForUpdate(); setUpdate(found); setUpdateNote(found ? `Version ${found.version} is available.` : 'You have the latest version.') }
    catch (error) { setUpdateNote(`Could not check for updates: ${message(error)}`) }
  }
  async function installUpdate() {
    if (!update || installing) return
    setInstalling(true)
    try { await flush(); await update.install() }
    catch (error) { setInstalling(false); setError(`The update could not be installed: ${message(error)} Your writing is saved. Try again later.`) }
  }

  useEffect(() => {
    if (!desktop || !lib?.settings.backupFolder) return
    let active = true, running = false, lastDay = ''
    // Only ask the native side (a Node process and a library read) once the local day has changed.
    const check = async () => { if (running || lastDay === localDay()) return; running = true; try { const result = await api.backup('daily'); if (active) { setBackupInfo(result); if (result.lastBackupAt) lastDay = localDay(new Date(result.lastBackupAt)) } } catch (error) { if (active) setError(message(error)) } finally { running = false } }
    void check(); const timer = window.setInterval(() => { void check() }, 60000)
    return () => { active = false; clearInterval(timer) }
  }, [lib?.settings.backupFolder])

  const flush = useCallback(() => session.current!.flush(), [])
  useEffect(() => {
    if (!draft || !session.current!.dirty) return
    const timer = window.setTimeout(() => { void flush().catch(() => {}) }, 800)
    return () => clearTimeout(timer)
  }, [draft, flush])
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => { if (session.current!.dirty) { event.preventDefault(); event.returnValue = '' } }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [])
  useEffect(() => {
    if (!desktop) return
    let disposed = false; let unlisten: (() => void) | undefined; let closing = false
    void import('@tauri-apps/api/window').then(async ({ getCurrentWindow }) => {
      const window = getCurrentWindow()
      const stop = await window.onCloseRequested(async (event: { preventDefault: () => void }) => {
        if (closing) return
        event.preventDefault()
        try { await flush() } catch { return }
        try { await api.backup('close'); closing = true; await window.close() } catch (error) {
          closing = false; setError(message(error)); closeWithoutBackup.current = async () => { await flush(); closing = true; await window.close() }; setDialog('backup-close')
        }
      })
      if (disposed) stop(); else unlisten = stop
    })
    return () => { disposed = true; unlisten?.() }
  }, [flush])

  function changeMode(next: WritingMode) {
    if (!lib || !draft) return
    session.current!.edit({ mode: next }, false)
    const settings = { ...lib.settings, lastMode: next }
    setLib(old => old && { ...old, settings })
    void api.settings(settings).catch(error => setError(message(error)))
    setRoom('write'); setFocus(false); setLeftOpen(false); setRightOpen(false); setResearchOpen(false)
    view.current?.focus()
  }
  function focusIssue(issue: Issue) {
    const editor = view.current
    if (!editor || !currentIssue(editor, issue)) return
    editor.dispatch({ selection: { anchor: issue.from, head: issue.to }, scrollIntoView: true }); editor.focus()
  }
  function acceptIssue(issue: Issue, replacement: string) {
    if (view.current) acceptCheckIssue(view.current, issue, replacement)
  }
  function ignoreOnce(issue: Issue) {
    if (view.current && currentIssue(view.current, issue)) view.current.dispatch({ effects: ignoreCheckIssue.of(issue) })
  }
  function ignoreAlways(issue: Issue) {
    const current = session.current!.project
    if (!current || !view.current || !currentIssue(view.current, issue)) return
    session.current!.edit({ ignoredIssues: [...(current.ignoredIssues ?? []), ruleFor(issue)] }, false)
  }
  function toggleUnderlines() {
    if (!lib) return
    const settings = { ...lib.settings, underlines: !lib.settings.underlines }
    setLib(old => old && { ...old, settings })
    void api.settings(settings).catch(error => setError(message(error)))
  }
  const changeModeRef = useRef(changeMode); changeModeRef.current = changeMode
  function edit(patch: Partial<Project>) { session.current!.edit(patch); setPlan(null) }
  // The personal dictionary lives in settings.json, one word list per language.
  async function addToDictionary(language: 'en' | 'tr', word: string) {
    if (!lib) return
    const settings = { ...lib.settings, dictionary: { ...lib.settings.dictionary, [language]: [...new Set([...(lib.settings.dictionary?.[language] ?? []), word])] } }
    setLib(old => old && { ...old, settings })
    try { await api.settings(settings) } catch (error) { setError(message(error)) }
  }
  function editText(body: string) {
    const current = session.current!.project
    if (!current) return
    const before = current.sections?.find(n => n.id === sectionId)?.body ?? current.body
    const writingLog = recordWriting(current, before, body)
    if (sectionId) edit({ writingLog, sections: (current.sections ?? []).map(n => n.id === sectionId ? { ...n, body } : n) })
    else edit({ body, writingLog })
  }
  async function keepSnapshot(label: string) {
    const current = session.current!.project
    if (!current) return
    edit({ snapshots: [...(current.snapshots ?? []), takeSnapshot(current, sectionId, label)] })
    await flush()
  }
  async function perform(action: () => Promise<void>) {
    if (busy) return
    setBusy(true); setError('')
    try { await action() } catch (e) { setError(message(e)) } finally { setBusy(false) }
  }
  async function create(title = '', idea?: Idea, type: ProjectType = 'blog') {
    await flush()
    const project = await api.saveProject(newProject(title, idea?.id, type))
    if (idea) await api.saveIdea({ ...idea, status: 'Draft', projectId: project.id })
    await refresh(); select(project); setRoom('write'); setFocus(false)
  }
  async function openProject(project: Project) { await flush(); const data = await refresh(); const latest = data.projects.find(p => p.id === project.id); if (!latest) throw new Error('This writing was moved. Reload the library.'); select(latest); setRoom('write') }
  async function addIdea() {
    if (!capture.trim()) return
    await api.saveIdea({ schemaVersion: 1, id: crypto.randomUUID(), title: capture.trim(), tags: tag ? [tag] : [], status: 'Idea', createdAt: new Date().toISOString() })
    setCapture(''); await refresh(); captureInput.current?.focus()
  }
  async function importImages() { await api.importImages(); await refresh() }
  function insert(image: ImageRecord) {
    if (!draft) return
    const editor = view.current
    const alt = image.name.replace(/\.[^.]+$/, '').replace(/[\[\]\\\r\n]/g, '')
    const text = `\n\n![${alt}](yazi-image:${image.id})\n\n`
    if (editor) { const range = editor.state.selection.main; editor.dispatch({ changes: { from: range.from, to: range.to, insert: text }, selection: { anchor: range.from + text.length } }); editor.focus() }
    else editText((draft.sections?.find(n => n.id === sectionId)?.body ?? draft.body) + text)
  }
  function openSettings() { if (lib) { setSettings({ ...lib.settings }); setDialog('settings'); void api.backup('status').then(setBackupInfo).catch(error => setError(message(error))) } }
  async function openPublish() { await flush(); if (session.current!.project?.type !== 'blog') { setExportResult(null); setDialog('export'); return } setPlan(null); setAcknowledged(false); setDialog('publish') }
  const shortcuts = useRef({ research: () => {}, newProject: () => {}, export: () => {}, snapshots: () => {}, chapter: () => {}, scene: () => {}, cards: () => {}, notes: () => {}, create: () => {}, save: () => {}, idea: () => {}, publish: () => {}, settings: () => {}, help: () => {} })
  function addFromKeyboard(kind: 'chapter' | 'scene') {
    const project = session.current!.project
    if (busy || !project || project.type === 'blog' || kind === 'chapter' && project.type !== 'book') return
    try { const result = addSection(project, kind, sectionId); edit({ sections: result.sections }); setSectionId(result.id); setRoom('write') } catch (error) { setError(message(error)) }
  }
  shortcuts.current = {
    research: () => { if (researchOpen) closeResearch(); else if (draft) { if (mode === 'review') changeMode('normal'); setRoom('write'); setFocus(false); setResearchOpen(true) } },
    newProject: () => { if (!busy) { setProjectTitle(''); setDialog('new-project') } },
    export: () => { if (!busy && draft && draft.type !== 'blog') void perform(openPublish) },
    snapshots: () => { if (!busy && draft && draft.type !== 'blog') setDialog('snapshots') },
    chapter: () => addFromKeyboard('chapter'), scene: () => addFromKeyboard('scene'),
    cards: () => { if (draft && draft.type !== 'blog') { if (mode === 'review') changeMode('normal'); setTab('Cards'); if (compactRight) { setLeftOpen(false); setRightOpen(true) } } }, notes: () => { if (draft && draft.type !== 'blog') { if (mode === 'review') changeMode('normal'); setTab('Notes'); if (compactRight) { setLeftOpen(false); setRightOpen(true) } } },
    create: () => { if (!busy) void perform(() => create()) }, save: () => { void flush().catch(() => {}) },
    idea: () => { setFocus(false); setRoom('ideas'); setTimeout(() => captureInput.current?.focus(), 0) },
    publish: () => { if (!busy && draft) void perform(openPublish) }, settings: openSettings, help: () => setDialog('help'),
  }
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      if (!dialog && event.key === 'Escape' && modeRef.current === 'write') { event.preventDefault(); changeModeRef.current('normal'); return }
      if (!dialog && shortcutMode(event)) { event.preventDefault(); changeModeRef.current(shortcutMode(event)!); return }
      if (modeRef.current === 'write' && !dialog) { if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 's') { event.preventDefault(); shortcuts.current.save() } return }
      if (event.key === 'Escape') { if (!dialog) { if (researchOpen) closeResearch(); else if (rightOpen) closeDrawer('right'); else if (leftOpen) closeDrawer('left'); else setFocus(false) } return }
      if (event.key === 'F1') { event.preventDefault(); shortcuts.current.help(); return }
      if (dialog) return
      if (event.ctrlKey || event.metaKey) {
        const key = event.key.toLowerCase()
        if (key === 'n' && event.shiftKey) { event.preventDefault(); shortcuts.current.newProject() }
        else if (key === 'e' && event.shiftKey) { event.preventDefault(); shortcuts.current.export() }
        else if (key === 'v' && event.altKey) { event.preventDefault(); shortcuts.current.snapshots() }
        else if (event.code === 'Digit1' && event.altKey) { event.preventDefault(); shortcuts.current.chapter() }
        else if (event.code === 'Digit2' && event.altKey) { event.preventDefault(); shortcuts.current.scene() }
        else if (key === 'k' && event.altKey) { event.preventDefault(); shortcuts.current.cards() }
        else if (key === 'n' && event.altKey) { event.preventDefault(); shortcuts.current.notes() }
        else if (key === 'r' && event.altKey) { event.preventDefault(); shortcuts.current.research() }
        else if (key === 's') { event.preventDefault(); shortcuts.current.save() }
        else if (key === 'n') { event.preventDefault(); shortcuts.current.create() }
        else if (key === 'i' && event.shiftKey) { event.preventDefault(); shortcuts.current.idea() }
        else if (key === 'enter' && event.shiftKey) { event.preventDefault(); shortcuts.current.publish() }
        else if (key === '.') { event.preventDefault(); setFocus(f => !f); setRoom('write') }
        else if (key === 't' && event.altKey) { event.preventDefault(); setTypewriter(value => !value) }
        else if (key === ',') { event.preventDefault(); shortcuts.current.settings() }
      }
    }
    document.addEventListener('keydown', keydown); return () => document.removeEventListener('keydown', keydown)
  }, [dialog, rightOpen, leftOpen, researchOpen])

  if (!lib) return <main className="startup"><span className="brand">Yazı<span>·</span></span>{error ? <><p role="alert">{error}</p><button onClick={() => location.reload()}>Try again</button></> : <p>Opening your writing desk…</p>}</main>
  const activeSection = draft?.sections?.find(n => n.id === sectionId && !n.trashedAt)
  const activeBody = activeSection?.body ?? draft?.body ?? ''
  const count = words(draft ? [draft.body, ...(draft.sections ?? []).filter(n => !n.trashedAt).map(n => n.body)].join('\n') : '')
  const today = draft?.writingLog?.find(row => row.date === localDay())
  const projects = [...lib.projects].filter(p => (filter === 'all' || (filter === 'published' ? !!p.published : !p.published)) && p.title.toLowerCase().includes(search.toLowerCase())).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  const tags = [...new Set(lib.ideas.flatMap(i => i.tags))].sort()
  const canPublish = draft && draft.type === 'blog' && !draft.published && draft.title.trim() && draft.body.trim() && draft.slug && draft.date
  const imageInUse = (id: string) => lib.projects.some(p => imageText(p).includes(`yazi-image:${id}`)) || !!draft && imageText(draft).includes(`yazi-image:${id}`)

  return <div className={`app mode-${draft ? mode : 'normal'} ${focus ? 'focus-mode' : ''} ${typewriter ? 'typewriter-mode' : ''} ${focus || typewriter ? 'distraction-mode' : ''} ${chromeVisible ? 'chrome-visible' : ''}`} onPointerMove={e => { if (focus || typewriter) setChromeVisible(e.clientY < 140) }}>
    <div className="chrome-hotspot" onPointerEnter={() => setChromeVisible(true)} aria-hidden="true"/>
    <header className="topbar"><button className="brand" onClick={() => { setFocus(false); setRoom('write') }} aria-label="Yazı writing desk">Yazı<span>·</span></button><span className="top-caption">A little room for your words.</span><nav aria-label="Main navigation"><button className={room === 'write' ? 'active' : ''} onClick={() => setRoom('write')}>Write</button><button className={room === 'ideas' ? 'active' : ''} onClick={() => { setRoom('ideas'); setFocus(false) }}>Idea box <span className="nav-count">{lib.ideas.length}</span></button></nav><div className="top-actions"><button aria-pressed={typewriter} title="Typewriter mode (Ctrl+Alt+T)" onClick={() => setTypewriter(value => !value)}>Typewriter</button><button onClick={() => { setRoom('write'); setFocus(f => !f) }} title="Focus mode (Ctrl+.)">{focus ? 'Leave focus' : 'Focus'}</button><button onClick={openSettings} aria-label="Open settings" title="Settings (Ctrl+,)">Settings</button></div></header>
    {!desktop && <div className="preview-notice">Browser preview <span>Writing is saved in this browser. Open the desktop app for Documents files and site transfer.</span></div>}
    {update && !writing && <div className="update-banner" role="status"><span>Yazı {update.version} is ready. Installing restarts Yazı; your writing is saved first.</span><button className="outline-button" disabled={installing} onClick={() => void installUpdate()}>{installing ? 'Installing…' : 'Install and restart'}</button><button disabled={installing} onClick={() => setUpdate(null)}>Later</button></div>}
    {error && !dialog && <div className="error-banner" role="alert"><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}
    {compactRight && <button ref={rightToggle} className="drawer-toggle right-edge" aria-label="Toggle companion" aria-controls="writing-companion" aria-expanded={rightOpen} onClick={() => { if (rightOpen) closeDrawer('right'); else { setLeftOpen(false); setRightOpen(true) } }}>Companion</button>}
    {compactLeft && <button ref={leftToggle} className="drawer-toggle left-edge" aria-label="Toggle library" aria-controls="writing-library" aria-expanded={leftOpen} onClick={() => { if (leftOpen) closeDrawer('left'); else { setRightOpen(false); setLeftOpen(true) } }}>Library</button>}
    {(compactRight && rightOpen || compactLeft && leftOpen) && <div className="drawer-scrim" aria-hidden="true" onClick={() => closeDrawer(rightOpen ? 'right' : 'left')}/>}
    <div className="workspace">
      <aside ref={leftPanel} id="writing-library" className={`library ${compactLeft ? 'left-drawer' : ''} ${leftOpen ? 'drawer-open' : ''}`} aria-label="Writing library" aria-hidden={compactLeft && !leftOpen} inert={compactLeft && !leftOpen || compactRight && rightOpen} onKeyDown={e => trapDrawer(e, compactLeft && leftOpen)}><button className="drawer-close" onClick={() => closeDrawer('left')}>Close library</button><div className="section-label">YOUR DESK <span>01</span></div><button className="new-button" onClick={() => void perform(() => create())} disabled={busy}>＋ New writing <kbd>Ctrl N</kbd></button><button className="new-project-link" onClick={() => { setProjectTitle(''); setDialog('new-project') }} disabled={busy}>New story or book &rarr;</button><div className="library-filters"><button className={room === 'write' && filter === 'all' ? 'selected' : ''} onClick={() => { setRoom('write'); setFilter('all') }}>All writing <span>{lib.projects.length}</span></button><button className={room === 'write' && filter === 'draft' ? 'selected' : ''} onClick={() => { setRoom('write'); setFilter('draft') }}>Drafts <span>{lib.projects.filter(p => !p.published).length}</span></button><button className={room === 'write' && filter === 'published' ? 'selected' : ''} onClick={() => { setRoom('write'); setFilter('published') }}>Published <span>{lib.projects.filter(p => p.published).length}</span></button><button className={room === 'images' ? 'selected' : ''} onClick={() => { setRoom('images'); setFocus(false) }}>Images <span>{lib.images.length}</span></button></div><div className="library-divider"/>{draft && draft.type !== 'blog' && <Outline project={draft} selected={sectionId} choose={id => { setSectionId(id); setRoom('write') }} change={sections => edit({ sections })} disabled={busy}/>} <label className="search-label"><span className="sr-only">Search writing</span><input placeholder="Find a piece…" value={search} onChange={e => setSearch(e.target.value)} /></label><div className="document-list">{projects.map(p => <button key={p.id} className={`document ${draft?.id === p.id ? 'selected' : ''}`} onClick={() => void perform(() => openProject(p))} disabled={busy}><span>{p.title || 'Untitled'}</span><small>{p.date} <i>·</i> {p.published ? 'Published' : 'Draft'}</small></button>)}{projects.length === 0 && <p className="quiet library-empty">{search ? 'No matching writing.' : 'A blank page is a good place to start.'}</p>}</div><div className="library-bottom"><button onClick={() => { setRoom('trash'); setFocus(false) }}>Trash <span>{lib.trash.length}</span></button><button onClick={() => setDialog('help')}>Keyboard shortcuts <kbd>F1</kbd></button><small>LOCAL FILES. YOUR WORDS.</small></div></aside>

      {room === 'write' && <>
        <main className="writing-area" inert={compactRight && rightOpen || compactLeft && leftOpen}>{draft ? <><div className="document-toolbar" role="toolbar" aria-label="Project actions"><div><span className="status-dot"/> {draft.published ? 'SENT TO SITE' : draft.type === 'blog' ? 'BLOG POST' : draft.type.toUpperCase()} <span className="toolbar-divider">/</span> <span>{draft.published ? 'Published' : 'Draft'}</span></div><div><select aria-label="Writing mode" value={mode} onChange={event => changeMode(event.target.value as WritingMode)}>{modes.map(value => <option key={value} value={value}>{modeNames[value]}</option>)}</select>{mode === 'normal' && <button aria-pressed={lib.settings.underlines === true} onClick={toggleUnderlines}>Underlines</button>}<button ref={researchToggle} className="toolbar-action" aria-expanded={researchOpen} aria-controls="research-drawer" title="Research (Ctrl+Alt+R)" onClick={() => shortcuts.current.research()}>Research{newInboxCount(research.research) > 0 && <span className="research-count">{newInboxCount(research.research)} new</span>}</button><button onClick={() => void perform(async () => { await flush(); await api.trash('projects', draft.id, draft.title || 'Untitled'); const next = await refresh(); select(next.projects[0] ?? null) })} disabled={busy} title="Move writing to trash">Archive</button>{draft.type !== 'blog' && <><button className="toolbar-action" onClick={() => { setExportResult(null); setDialog('export') }} disabled={busy}>Export</button><button onClick={() => setDialog('snapshots')} disabled={busy}>Snapshots</button><button onClick={() => void perform(async () => { await keepSnapshot('Before rewriting: ' + (activeSection?.title ?? draft.title)); setStatus('Snapshot kept. Ready to rewrite.'); setTimeout(() => view.current?.focus(), 0) })} disabled={busy}>Start a rewrite</button></>}{draft.type === 'blog' && <button className="toolbar-action" onClick={() => void perform(openPublish)} disabled={busy || !canPublish}>{draft.published ? 'Sent to site' : 'Send to site'} <span>↗</span></button>}</div></div><div className="paper" inert={busy}><div className="eyebrow">MAKE A LITTLE SPACE. WRITE.</div><input className="title-input" aria-label="Title" placeholder="Untitled" value={draft.title} onChange={e => { const title = e.target.value; edit({ title, ...(!draft.slug || draft.slug === slugify(draft.title) ? { slug: slugify(title) } : {}) }) }} /><div className="metadata"><label>PLACE<input placeholder="Somewhere" value={draft.place} onChange={e => edit({ place: e.target.value })}/></label><label>DATE<input type="text" inputMode="numeric" maxLength={10} placeholder="YYYY-MM-DD" pattern="[0-9]{4}-[0-9]{2}-[0-9]{2}" value={draft.date} onChange={e => edit({ date: e.target.value })}/></label><label>TAGS<input placeholder="Add tags, separated by commas" value={tagText} onChange={e => { setTagText(e.target.value); edit({ tags: e.target.value.split(',').map(x => x.trim()).filter(Boolean) }) }}/></label><label>LANGUAGE<select value={draft.language ?? 'auto'} onChange={e => edit({ language: e.target.value as 'en' | 'tr' | 'auto' })}><option value="auto">Detect per paragraph</option><option value="en">English</option><option value="tr">Turkish</option></select></label></div><div className="paper-rule"/>{draft.type !== 'blog' && <div className="section-heading"><span className="eyebrow">{activeSection ? activeSection.kind.toUpperCase() : draft.type === 'story' ? 'SINGLE TEXT' : 'OPENING'}</span>{activeSection && <input aria-label="Section title" value={activeSection.title} onChange={e => edit({ sections: (draft.sections ?? []).map(n => n.id === activeSection.id ? { ...n, title: e.target.value } : n) })}/>}</div>}<Editor ignoreRules={draft.ignoredIssues} onIssues={(issues, checking) => { setIssues(issues); setChecking(checking) }} checking={underlinesShown(mode, lib.settings)} id={draft.id + ':' + (sectionId ?? 'main') + ':' + editorEpoch} body={activeBody} onChange={editText} typewriter={typewriter} language={draft.language ?? 'auto'} dictionary={lib.settings.dictionary} ignored={draft.ignoredWords} onAddWord={(word, language) => void addToDictionary(language, word)} onIgnoreWord={word => edit({ ignoredWords: [...new Set([...(session.current!.project?.ignoredWords ?? []), word])] })} onSpellError={setError} cards={draft.cards} onCardOpen={id => { if (mode === 'review') changeMode('normal'); setSelectedCardId(id); setTab('Cards'); if (compactRight) { setLeftOpen(false); setRightOpen(true) } }} onReady={v => { view.current = v }} /></div><footer className="editor-footer"><span>{count.toLocaleString()} words <i>·</i> {Math.max(1, Math.ceil(count / 200))} min read</span>{draft.type !== 'blog' && (draft.dailyGoal ?? 500) > 0 && <progress className="daily-goal-line" aria-label="Words written today" aria-valuetext={`${Math.max(0, (today?.added ?? 0) - (today?.removed ?? 0))} of ${draft.dailyGoal ?? 500} words today`} title="Daily writing goal" max={draft.dailyGoal ?? 500} value={Math.min(draft.dailyGoal ?? 500, Math.max(0, (today?.added ?? 0) - (today?.removed ?? 0)))}/>} <span className={status.startsWith('Not') ? 'save-error' : ''} role="status">{status}</span><button onClick={() => { setRoom('write'); setFocus(f => !f) }} title="Ctrl+.">{focus ? 'Leave focus' : 'Focus mode'} <kbd>Ctrl .</kbd></button></footer></> : <div className="blank-desk"><div className="eyebrow">YOUR WRITING DESK</div><h1>There’s a story<br/>in there somewhere.</h1><p>A thought, a place, a sentence you don’t want to lose.<br/>Give it a page.</p><button className="accent-button" onClick={() => void perform(() => create())} disabled={busy}>Start writing <span>＋</span></button><button className="text-link" onClick={() => setRoom('ideas')}>Or catch an idea first →</button></div>}</main>
        {mode === 'review' && draft && <ReviewPanel issues={issues} checking={checking} focus={focusIssue} accept={acceptIssue} add={issue => void addToDictionary(issue.language, issue.original)} ignore={ignoreOnce} ignoreAlways={ignoreAlways}/>}
        <aside ref={rightPanel} id="writing-companion" className={`side-panel ${compactRight ? 'right-drawer' : ''} ${rightOpen ? 'drawer-open' : ''}`} aria-label="Writing companion" aria-hidden={compactRight && !rightOpen} inert={compactRight && !rightOpen || compactLeft && leftOpen} onKeyDown={e => trapDrawer(e, compactRight && rightOpen)}><button className="drawer-close" onClick={() => closeDrawer('right')}>Close companion</button><div className="panel-tabs" role="tablist" aria-label="Companion tabs">{(draft && draft.type !== 'blog' ? ['Preview', 'Cards', 'Notes', 'Check', 'Images'] as const : ['Preview', 'Check', 'Images'] as const).map(t => <button role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} key={t} onClick={() => setTab(t)} id={`tab-${t}`} aria-controls="companion-content">{t}</button>)}</div><div className="panel-content" role="tabpanel" id="companion-content" aria-labelledby={`tab-${tab}`}>{tab === 'Preview' ? <><div className="section-label">THE READING VIEW</div>{draft?.title && <h2 className="preview-title">{draft.title}</h2>}{draft?.standfirst && <p className="standfirst">{draft.standfirst}</p>}<Preview text={activeBody} images={lib.images}/></> : tab === 'Notes' && draft ? <Notebook key={draft.id} project={draft} change={edit} disabled={busy}/> : tab === 'Cards' && draft ? <Cards key={draft.id} selectedId={selectedCardId} cards={draft.cards ?? []} change={cards => edit({ cards })} disabled={busy}/> : tab === 'Images' ? <><div className="section-label">A PLACE FOR IMAGES</div><p className="quiet">Keep the originals. Prepare a lighter, private copy when sending to your site.</p><button className="outline-button" onClick={() => void perform(importImages)} disabled={busy}>＋ Add images</button><div className="image-grid compact">{lib.images.map(image => <ImageTile key={image.id} image={image} insert={draft ? () => insert(image) : undefined}/>)}</div></> : <><div className="section-label">A SECOND PAIR OF EYES</div><h3>Your voice stays yours.</h3><p className="quiet">Fact checks, sources and similar writing will arrive in phase 3. Suggestions will appear here, without changing your text.</p><div className="note-card">For now, a small pause:<br/><br/>Is the opening yours?<br/>Is there a detail only you noticed?<br/>Does the ending need to explain?</div><small className="quiet">No AI request is made.</small></>}</div><div className="panel-footnote">Take your time. It’s your page.</div></aside>
      </>}

      {room === 'write' && draft && !writing && researchOpen && <ResearchDrawer projectId={draft.id} projectTitle={draft.title} language={draft.language === 'tr' ? 'tr' : 'en'} suggestTopic={() => { const editor = view.current, range = editor?.state.selection.main, picked = range && !range.empty ? editor!.state.sliceDoc(range.from, range.to).trim() : ''; return picked && picked.length <= 200 ? picked : activeSection?.title || draft.title }} research={research.research} reload={research.reload} saveAnnotations={research.saveAnnotations} close={closeResearch} openSettings={openSettings} insert={insertQuote} sectionId={activeSection?.id ?? null} placeName={id => draft.sections?.find(n => n.id === id)?.title ?? (draft.type === 'blog' ? 'the text' : draft.type === 'story' ? 'Single text' : 'Opening')}/>}

      {room === 'ideas' && <main className="room idea-room"><div className="room-heading"><div><div className="eyebrow">BEFORE THE FIRST DRAFT</div><h1>Somewhere to begin.</h1><p className="quiet">Catch a thought. Let it become something.</p></div><span className="room-number">02 / IDEA BOX</span></div><form className="capture" onSubmit={e => { e.preventDefault(); void perform(addIdea) }}><input ref={captureInput} aria-label="New idea" placeholder="A sentence, a question, a place…" value={capture} onChange={e => setCapture(e.target.value)}/><button className="accent-button" disabled={busy || !capture.trim()}>Catch idea <span>＋</span></button></form><div className="tag-filters"><button className={!tag ? 'selected' : ''} onClick={() => setTag('')}>All ideas</button>{tags.map(t => <button key={t} className={tag === t ? 'selected' : ''} onClick={() => setTag(t)}>#{t}</button>)}<label className="tag-filter-input"><span className="sr-only">Filter or add a tag</span><input placeholder="Filter / add tag" value={tag} onChange={e => setTag(e.target.value)}/></label></div><div className="idea-board">{stages.map((stage, index) => { const ideas = lib.ideas.filter(i => i.status === stage && (!tag || i.tags.includes(tag))); return <section className="idea-column" key={stage} aria-label={stage}><div className="column-heading"><span><small>0{index + 1}</small> {stage}</span><span>{ideas.length}</span></div>{ideas.map(idea => <article className="idea-card" key={idea.id}><small>{new Date(idea.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</small><h3>{idea.title}</h3><div className="idea-tags">{idea.tags.map(t => <span key={t}>#{t}</span>)}</div><label className="sr-only" htmlFor={`stage-${idea.id}`}>Stage for {idea.title}</label><select id={`stage-${idea.id}`} value={idea.status} disabled={busy} onChange={e => void perform(async () => { await api.saveIdea({ ...idea, status: e.target.value as Idea['status'] }); await refresh() })}>{stages.map(s => <option key={s}>{s}</option>)}</select><label className="idea-tag-edit">Tags<input aria-label={`Tags for ${idea.title}`} defaultValue={idea.tags.join(', ')} onBlur={e => { const tags = e.target.value.split(',').map(t => t.trim()).filter(Boolean); if (JSON.stringify(tags) !== JSON.stringify(idea.tags)) void perform(async () => { await api.saveIdea({ ...idea, tags }); await refresh() }) }}/></label><div className="card-actions"><button disabled={busy} onClick={() => void perform(async () => { const project = lib.projects.find(p => p.id === idea.projectId); if (project) await openProject(project); else await create(idea.title, idea) })}>{idea.projectId ? 'Open draft' : 'Start writing'} ↗</button><button disabled={busy} aria-label={`Move idea ${idea.title} to trash`} onClick={() => void perform(async () => { await api.trash('ideas', idea.id, idea.title); await refresh() })}>×</button></div></article>)}{ideas.length === 0 && <p className="column-empty">{stage === 'Idea' ? 'Small thoughts welcome.' : stage === 'Research' ? 'Follow your curiosity.' : stage === 'Draft' ? 'Room for a first version.' : 'Words out in the world.'}</p>}</section> })}</div></main>}

      {room === 'images' && <main className="room"><div className="room-heading"><div><div className="eyebrow">THE VISUAL NOTEBOOK</div><h1>A detail worth keeping.</h1><p className="quiet">Originals stay here. Site copies lose GPS and serial numbers.</p></div><button className="accent-button" disabled={busy} onClick={() => void perform(importImages)}>＋ Add images</button></div><div className="image-grid">{lib.images.map(image => <ImageTile key={image.id} image={image} insert={draft ? () => { setRoom('write'); setTab('Images'); setTimeout(() => insert(image), 0) } : undefined} remove={!imageInUse(image.id) ? () => void perform(async () => { await api.trash('images', image.id, image.name); await refresh() }) : undefined}/>)}</div>{!lib.images.length && <div className="empty-room">Bring a photograph. Give the words some company.</div>}<p className="quiet">Images used in a draft stay in the library. Remove their references before moving them to trash.</p></main>}

      {room === 'trash' && <main className="room"><div className="eyebrow">NOTHING LOST</div><h1>Set aside, kept safe.</h1><p className="quiet">Removed writing, ideas and images can always come back.</p><div className="trash-list">{lib.trash.map(entry => <div key={entry.key}><div><strong>{entry.title}</strong><small>{entry.kind}</small></div><button className="outline-button" disabled={busy} onClick={() => void perform(async () => { await api.restore(entry); await refresh() })}>Restore</button></div>)}</div>{!lib.trash.length && <div className="empty-room">Nothing set aside yet.</div>}</main>}
    </div>


    {dialog === 'new-project' && <Modal error={error} title="A new beginning" close={() => setDialog(null)}><form onSubmit={e => { e.preventDefault(); void perform(async () => { await create(projectTitle, undefined, projectType); setDialog(null) }) }}><p className="quiet">Give your writing room to grow.</p><label className="field">Project type<select value={projectType} onChange={e => setProjectType(e.target.value as ProjectType)}><option value="blog">Blog post</option><option value="story">Story</option><option value="book">Book</option></select></label><label className="field">Project title<input autoFocus placeholder="A working title is enough" value={projectTitle} onChange={e => setProjectTitle(e.target.value)}/></label><p className="quiet">{projectType === 'blog' ? 'One text, ready for your journal.' : projectType === 'story' ? 'A single text or a handful of scenes.' : 'Chapters and scenes, at your own pace.'}</p><button className="accent-button" disabled={busy}>Create project</button></form></Modal>}

    {dialog === 'snapshots' && draft && <Modal error={error} title="A few versions of the same thought" close={() => { if (!busy) setDialog(null) }}><Snapshots project={draft} scopeId={sectionId} disabled={busy} keep={label => void perform(() => keepSnapshot(label))} restore={snapshot => void perform(async () => { edit(restoreSnapshot(session.current!.project!, snapshot)); setSectionId(snapshot.scopeId); setEditorEpoch(n => n + 1); await flush(); setDialog(null) })}/></Modal>}

    {dialog === 'export' && draft && <Modal error={error} title="A finished copy" close={() => { if (!busy) setDialog(null) }}><ExportPanel project={draft} disabled={busy} result={exportResult} quoted={research.research?.sources.filter(s => s.status === 'used').length ?? 0} run={(format, includeSources) => void perform(async () => { await flush(); setExportResult(await api.exportProject(session.current!.project!, format, lib.images, includeSources)) })}/></Modal>}
    {dialog === 'backup-close' && <Modal error={error} title="Your writing is saved" close={() => setDialog(null)}><p className="quiet">The backup could not be completed. Reconnect the backup drive and keep Yazı open to try again, or close with your writing saved in Documents.</p><div className="dialog-actions"><button className="accent-button" onClick={() => setDialog(null)}>Keep open</button><button onClick={() => { void closeWithoutBackup.current?.().catch(error => setError(message(error))) }}>Close without backup</button></div></Modal>}
    {dialog === 'help' && <Modal error={error} title="A few familiar keys" close={() => setDialog(null)}><dl className="shortcut-list">{[['Write / Review / Normal', 'Ctrl 1 / 2 / 3'], ['Leave Write mode', 'Esc'], ['New writing', 'Ctrl N'], ['New story or book', 'Ctrl Shift N'], ['Add chapter / scene', 'Ctrl Alt 1 / 2'], ['Character/place cards', 'Ctrl Alt K'], ['Project notebook', 'Ctrl Alt N'], ['Snapshots', 'Ctrl Alt V'], ['Research', 'Ctrl Alt R'], ['Export story or book', 'Ctrl Shift E'], ['Save now', 'Ctrl S'], ['Catch an idea', 'Ctrl Shift I'], ['Send to site', 'Ctrl Shift Enter'], ['Typewriter mode', 'Ctrl Alt T'], ['Focus mode', 'Ctrl .'], ['Settings', 'Ctrl ,'], ['Keyboard help', 'F1'], ['Leave focus / close dialog', 'Esc'], ['Undo / redo', 'Ctrl Z / Ctrl Shift Z']].map(([label, key]) => <div key={label}><dt>{label}</dt><dd><kbd>{key}</kbd></dd></div>)}</dl><p className="quiet">Use Tab and Shift Tab to reach every control. Text saves automatically while you write.</p><div className="help-feedback"><span className="section-label">TELL US</span><p className="quiet">Opens a GitHub issue in your browser with the app version and Windows version filled in. Your writing is never included.</p><div className="dialog-actions"><button className="outline-button" onClick={() => void systemInfo().then(info => api.openLink(issueUrl('feedback', info))).catch(error => setError(message(error)))}>Send feedback ↗</button><button className="outline-button" onClick={() => void systemInfo().then(info => api.openLink(issueUrl('bug', info))).catch(error => setError(message(error)))}>Report a bug ↗</button></div></div></Modal>}
    {dialog === 'settings' && settings && <Modal error={error} title="Make yourself at home" close={() => setDialog(null)}><form onSubmit={e => { e.preventDefault(); void perform(async () => { await api.settings(settings); await refresh(); setDialog(null) }) }}><label className="field">Appearance<select value={settings.theme} onChange={e => setSettings({ ...settings, theme: e.target.value as Settings['theme'] })}><option value="light">Warm paper</option><option value="dark">After hours</option></select></label><label className="field">Site repository<input value={settings.siteRepo} onChange={e => setSettings({ ...settings, siteRepo: e.target.value })}/><small>The local duruduygu.com repository. Node.js 22 and its npm dependencies are needed for sending.</small></label><BackupSettings settings={settings} change={setSettings} info={backupInfo} busy={busy} run={() => void perform(async () => { await api.settings(settings); await flush(); setBackupInfo(await api.backup('manual')); await refresh() })}/><AiSettings/>{desktop && <div className="settings-updates"><label className="acknowledge"><input type="checkbox" checked={settings.checkUpdates !== false} onChange={e => setSettings({ ...settings, checkUpdates: e.target.checked })}/> Check for a new version when Yazı starts</label><small>Asks GitHub for the latest release; nothing about you or your writing is sent. Yazı always asks before installing.</small><div><button type="button" className="outline-button" onClick={() => void checkUpdatesNow()}>Check for updates</button> <span className="quiet" role="status">{updateNote}</span></div></div>}<div className="settings-info"><span className="section-label">YOUR FILES</span><p>{lib.dataRoot}</p><small>Plain Markdown and JSON. No account or cloud sync.</small></div><p className="quiet">AI checks will arrive in phase 3, using Claude Code by default.</p><button className="accent-button" disabled={busy}>Save settings</button></form></Modal>}
    {dialog === 'publish' && draft && <Modal error={error} title="Send these words out" close={() => { if (!busy) setDialog(null) }}><p className="quiet">Prepare a local site branch for <strong>{draft.title || 'Untitled'}</strong>.</p><label className="field">Address<input value={draft.slug} disabled={busy} onChange={e => edit({ slug: e.target.value })}/><small>duruduygu.com/blog/{draft.slug || 'your-address'}</small></label><label className="field">Excerpt<input placeholder="One line for the journal list" value={draft.excerpt} disabled={busy} onChange={e => edit({ excerpt: e.target.value })}/></label><label className="field">Standfirst<textarea placeholder="The opening lines, set a little larger" value={draft.standfirst} disabled={busy} onChange={e => edit({ standfirst: e.target.value })}/></label><ul className="checklist"><li>{draft.title.trim() ? '✓' : '○'} A title of your own</li><li>{draft.body.trim() ? '✓' : '○'} Text ready to read</li><li>{draft.date ? '✓' : '○'} A date for the journal</li><li>✓ Originals kept; site images resized and privacy checked</li><li>{draft.ideaId ? '✓ Linked idea moves to Published after commit' : '— No linked idea card'}</li></ul>{!desktop && <p className="inline-notice">Site transfer needs the desktop app.</p>}{plan && <div className="publish-plan"><div className="section-label">FILES TO WRITE</div>{plan.files.map(file => <code key={file}>{file}</code>)}<p>Branch <code>{plan.branch}</code></p><p className="quiet">Run the content check, then commit these files locally.</p><label className="acknowledge"><input type="checkbox" checked={acknowledged} onChange={e => setAcknowledged(e.target.checked)}/> I’ve reviewed the files and branch.</label></div>}<div className="dialog-actions"><button className="outline-button" disabled={busy || !desktop || !canPublish} onClick={() => void perform(async () => { await flush(); setPlan(await api.plan(session.current!.project!)); setAcknowledged(false) })}>{busy ? 'Working…' : 'Check repository'}</button><button className="accent-button" disabled={busy || !plan || !acknowledged} onClick={() => void perform(async () => { await flush(); const result = await api.publish(session.current!.project!); const data = await refresh(); select(data.projects.find(p => p.id === draft.id) ?? null); setDialog(null); setStatus(`Committed on ${result.branch} · ${result.commit.slice(0, 7)}`) })}>Create local commit ↗</button></div><small className="quiet">Push is a separate step that requires your approval.</small></Modal>}
  </div>
}
