// Types for the parts of research-format.mjs the TypeScript app imports.
export type CitedSource = { title: string; site?: string; published?: string; saved?: string; url?: string }
export function citation(source: CitedSource): string
export function quotedSources<T extends { status: string; usedIn?: { at: string }[]; addedAt?: string }>(index: { sources?: T[] } | null | undefined): T[]
