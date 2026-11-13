// A bounded, local breadcrumb trail. Never include document text, error messages,
// URLs, request payloads or settings: any of them may contain private writing/keys.
type Kind = 'boot' | 'page-show' | 'page-hide' | 'visibility' | 'script-error' | 'rejection' | 'react-fatal' | 'worker-error' | 'worker-message-error' | 'vite-reload'
const key = 'divit-runtime-diagnostics-v1'
export function recordRuntime(kind: Kind, error?: unknown) {
  try {
    const app = document.querySelector('.app')
    const entry = {
      at: new Date().toISOString(), kind,
      errorType: error instanceof Error && ['Error', 'TypeError', 'RangeError', 'SyntaxError', 'ReferenceError'].includes(error.name) ? error.name : undefined,
      // Only source line/column locations, never the message or arbitrary stack text.
      locations: error instanceof Error ? [...(error.stack ?? '').matchAll(/\/(src\/[^\s?#:)]+|assets\/[^\s?#:)]+):(\d+):(\d+)/g)].slice(0, 8).map(m => `${m[1]}:${m[2]}:${m[3]}`) : undefined,
      visibility: document.visibilityState,
      rootChildren: document.getElementById('root')?.childElementCount ?? 0,
      focus: app?.classList.contains('focus-mode') ?? false,
      mode: ['normal', 'write', 'review'].find(mode => app?.classList.contains(`mode-${mode}`)),
    }
    const saved: unknown = JSON.parse(localStorage.getItem(key) ?? '[]')
    const entries = Array.isArray(saved) ? saved.slice(-39) : []
    localStorage.setItem(key, JSON.stringify([...entries, entry]))
  } catch { /* Logging must never interrupt writing, including when storage is blocked/full. */ }
}

export function installRuntimeDiagnostics() {
  recordRuntime('boot')
  window.addEventListener('error', event => recordRuntime('script-error', event.error))
  window.addEventListener('unhandledrejection', event => recordRuntime('rejection', event.reason))
  window.addEventListener('pageshow', () => recordRuntime('page-show'))
  window.addEventListener('pagehide', () => recordRuntime('page-hide'))
  document.addEventListener('visibilitychange', () => recordRuntime('visibility'))
  import.meta.hot?.on('vite:beforeFullReload', () => recordRuntime('vite-reload'))
}
