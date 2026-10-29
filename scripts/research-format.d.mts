// Types for the parts of research-format.mjs the TypeScript app imports.
export type CitedSource = { title: string; site?: string; published?: string; saved?: string; url?: string }
export function citation(source: CitedSource): string
