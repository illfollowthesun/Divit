export type Stage = 'Idea' | 'Research' | 'Draft' | 'Published'
export type Project = {
  schemaVersion: 1; id: string; type: 'blog'; title: string; slug: string; date: string; place: string;
  tags: string[]; excerpt: string; standfirst: string; body: string; createdAt: string; updatedAt: string;
  ideaId?: string; revision?: string; published?: PublishResult
}
export type Idea = { schemaVersion: 1; id: string; title: string; tags: string[]; status: Stage; createdAt: string; projectId?: string; revision?: string }
export type ImageRecord = { id: string; file: string; name: string; addedAt: string; dataUrl?: string }
export type Settings = { schemaVersion: number; theme: 'light' | 'dark'; siteRepo: string; aiProvider: 'claude-code' | 'anthropic' | 'ollama' }
export type TrashEntry = { key: string; kind: 'projects' | 'ideas' | 'images'; id: string; title: string; content?: Project | Idea | ImageRecord }
export type Library = { projects: Project[]; ideas: Idea[]; images: ImageRecord[]; settings: Settings; trash: TrashEntry[]; dataRoot: string }
export type PublishPlan = { branch: string; files: string[]; used: string[] }
export type PublishResult = PublishPlan & { commit: string; check: string; digest: string }
export const stages: Stage[] = ['Idea', 'Research', 'Draft', 'Published']
export function slugify(value: string) {
  const chars: Record<string, string> = { ı: 'i', İ: 'i', ş: 's', Ş: 's', ğ: 'g', Ğ: 'g', ü: 'u', Ü: 'u', ö: 'o', Ö: 'o', ç: 'c', Ç: 'c' }
  return value.replace(/[ıİşŞğĞüÜöÖçÇ]/g, c => chars[c]).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100).replace(/-+$/g, '')
}
export function newProject(title = '', ideaId?: string): Project {
  const now = new Date(); const date = new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10)
  return { schemaVersion: 1, id: crypto.randomUUID(), type: 'blog', title, slug: slugify(title), date, place: '', tags: [], excerpt: '', standfirst: '', body: '', createdAt: now.toISOString(), updatedAt: now.toISOString(), ideaId }
}
export function words(text: string) { return text.trim() ? text.trim().split(/\s+/u).length : 0 }
