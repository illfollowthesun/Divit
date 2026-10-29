import { invoke, isTauri } from '@tauri-apps/api/core'
import { open } from '@tauri-apps/plugin-dialog'
import type { Idea, ImageRecord, Library, Project, PublishPlan, PublishResult, Settings, TrashEntry, ExportFormat, ExportTools, ExportResult, BackupInfo } from './types'

export const desktop = isTauri()
const key = 'yazi-browser-preview-v1'
function preview(): Library {
  const saved = localStorage.getItem(key)
  if (saved) return JSON.parse(saved)
  return { projects: [], ideas: [], images: [], trash: [], dataRoot: 'Browser preview · saved in this browser only', settings: { schemaVersion: 1, theme: 'light', siteRepo: 'C:\\Users\\edmes\\Documents\\modernist-portfolio', aiProvider: 'claude-code' } }
}
function persist(data: Library) { localStorage.setItem(key, JSON.stringify(data)) }
function savePreview<T extends Project | Idea>(collection: 'projects' | 'ideas', data: T): T {
  const lib = preview(); const list = lib[collection] as T[]; const index = list.findIndex(i => i.id === data.id)
  if (index >= 0 && list[index].revision !== data.revision) throw new Error('This item changed in another tab. Copy your text before reloading.')
  const result = { ...data, revision: crypto.randomUUID() }; if (index >= 0) list[index] = result; else list.push(result)
  persist(lib); return result
}
export const api = {
  backup: async (reason: 'status' | 'daily' | 'close' | 'manual'): Promise<BackupInfo> => {
    if (desktop) return invoke('backup_action', { reason })
    if (reason === 'manual') throw new Error('Backups use the Documents folder in the desktop app.')
    return { enabled: false, lastBackupAt: null }
  },
  chooseBackupFolder: async (): Promise<string | null> => {
    if (!desktop) return null
    const folder = await open({ directory: true, multiple: false, title: 'Choose a backup folder outside Yazi' })
    return typeof folder === 'string' ? folder : null
  },
  // Research files: the desktop app goes through the native storage lock, the preview through the dev server.
  research: async <T>(projectId: string, action: 'load' | 'read-source' | 'add-source' | 'update-source' | 'save-annotations' | 'scan-inbox' | 'pending' | 'fetch-page', payload: Record<string, unknown> = {}): Promise<T> => {
    if (desktop) return invoke('research_action', { projectId, action, payload })
    const response = await fetch('/__yazi/research', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Yazi-Preview': '1' }, body: JSON.stringify({ ...payload, projectId, action }) })
    const result = await response.json().catch(() => ({ error: 'Research needs the desktop app or the development preview.' }))
    if (!response.ok) throw new Error(result?.error ?? 'Research is unavailable.')
    return result as T
  },
  exportStatus: async (): Promise<ExportTools> => {
    if (desktop) return invoke('export_action', { action: 'status', projectId: null, expectedRevision: null, format: null })
    const response = await fetch('/__yazi/export')
    if (!response.ok) throw new Error('Restart the preview server to enable local exports.')
    return response.json()
  },
  exportProject: async (project: Project, format: ExportFormat, images: ImageRecord[]): Promise<ExportResult> => {
    if (desktop) return invoke('export_action', { action: 'export', projectId: project.id, expectedRevision: project.revision ?? null, format })
    const response = await fetch('/__yazi/export', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Yazi-Preview': '1' }, body: JSON.stringify({ project, format, images }) })
    if (!response.ok) throw new Error((await response.json()).error ?? 'Export failed.')
    const filename = /filename="([^"]+)"/.exec(response.headers.get('Content-Disposition') ?? '')?.[1] ?? `manuscript.${format === 'markdown' ? 'md' : format}`
    const url = URL.createObjectURL(await response.blob()), link = document.createElement('a')
    link.href = url; link.download = filename; link.click(); setTimeout(() => URL.revokeObjectURL(url), 10000)
    return { path: 'Browser download', filename, format }
  },
  library: async (): Promise<Library> => desktop ? invoke('library') : preview(),
  saveProject: async (data: Project): Promise<Project> => desktop ? invoke('save_project', { data, expected: data.revision ?? null }) : savePreview('projects', data),
  saveIdea: async (data: Idea): Promise<Idea> => desktop ? invoke('save_idea', { data, expected: data.revision ?? null }) : savePreview('ideas', data),
  settings: async (data: Settings) => { if (desktop) await invoke('save_settings', { data }); else { const lib = preview(); lib.settings = data; persist(lib) } },
  importImages: async (): Promise<ImageRecord[]> => {
    if (desktop) {
      const paths = await open({ multiple: true, filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'avif'] }] })
      const result: ImageRecord[] = []
      for (const source of paths ? Array.isArray(paths) ? paths : [paths] : []) result.push(await invoke('import_image', { source, key: crypto.randomUUID() }))
      return result
    }
    return new Promise((resolve, reject) => {
      const input = document.createElement('input'); input.type = 'file'; input.multiple = true; input.accept = 'image/jpeg,image/png,image/webp,image/avif'
      input.addEventListener('cancel', () => resolve([]))
      input.onchange = async () => {
        try {
          const images: ImageRecord[] = []
          for (const file of Array.from(input.files ?? [])) {
            if (file.size > 3 * 1024 * 1024) throw new Error('Use images under 3 MB in browser preview. Desktop supports 100 MB.')
            const dataUrl = await new Promise<string>((yes, no) => { const reader = new FileReader(); reader.onload = () => yes(String(reader.result)); reader.onerror = () => no(reader.error); reader.readAsDataURL(file) })
            images.push({ id: crypto.randomUUID(), file: `original.${file.name.split('.').pop()}`, name: file.name, addedAt: new Date().toISOString(), dataUrl })
          }
          const lib = preview(); lib.images.push(...images); persist(lib); resolve(images)
        } catch (e) { reject(e) }
      }; input.click()
    })
  },
  imageData: async (image: ImageRecord): Promise<string> => desktop ? invoke('image_data', { key: image.id }) : image.dataUrl ?? '',
  trash: async (kind: TrashEntry['kind'], id: string, title: string) => {
    if (desktop) return invoke('trash', { kind, key: id, title })
    const lib = preview(); const content = lib[kind].find(i => i.id === id); if (!content) throw new Error('Item not found')
    lib.trash.push({ key: crypto.randomUUID(), kind, id, title, content }); (lib[kind] as { id: string }[]) = lib[kind].filter(i => i.id !== id); persist(lib)
  },
  restore: async (entry: TrashEntry) => {
    if (desktop) return invoke('restore', { key: entry.key })
    const lib = preview(); if (lib[entry.kind].some(i => i.id === entry.id)) throw new Error('An item already uses this location.')
    if (entry.content) (lib[entry.kind] as unknown[]).push(entry.content); lib.trash = lib.trash.filter(i => i.key !== entry.key); persist(lib)
  },
  plan: async (project: Project): Promise<PublishPlan> => { if (!desktop) throw new Error('Open the desktop app to check your local site repository.'); return invoke('site_action', { action: 'plan', projectId: project.id, expectedRevision: project.revision ?? null }) },
  publish: async (project: Project): Promise<PublishResult> => { if (!desktop) throw new Error('Site transfer is available in the desktop app.'); return invoke('site_action', { action: 'publish', projectId: project.id, expectedRevision: project.revision ?? null }) },
}
