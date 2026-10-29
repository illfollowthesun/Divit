import { isTauri } from '@tauri-apps/api/core'
import { REPO_URL } from '../shared/app.ts'

// "Send feedback" and "Report a bug" open a GitHub issue in the writer's browser, matching the templates
// in .github/ISSUE_TEMPLATE. Only the app version and system details are filled in, never any writing.
export type SystemInfo = { version: string; os: string; scaling: string }
export async function systemInfo(): Promise<SystemInfo> {
  let version = 'browser preview'
  if (isTauri()) { try { version = await (await import('@tauri-apps/api/app')).getVersion() } catch { version = 'unknown' } }
  let os = /Windows/.test(navigator.userAgent) ? 'Windows' : navigator.platform || 'unknown'
  // Windows 11 still reports "Windows NT 10.0"; the platform version tells them apart (13 and up is 11).
  const data = (navigator as Navigator & { userAgentData?: { getHighEntropyValues: (hints: string[]) => Promise<{ platform?: string; platformVersion?: string }> } }).userAgentData
  try {
    const high = await data?.getHighEntropyValues(['platformVersion'])
    if (high?.platform === 'Windows' && high.platformVersion) os = `Windows ${Number(high.platformVersion.split('.')[0]) >= 13 ? '11' : '10'} (${high.platformVersion})`
  } catch { /* keep the coarse name */ }
  return { version, os, scaling: `${Math.round(devicePixelRatio * 100)}%` }
}
export function issueUrl(kind: 'bug' | 'feedback', info: SystemInfo) {
  const body = kind === 'bug'
    ? `**App version:** ${info.version}\n**Windows version / display scaling:** ${info.os} · ${info.scaling}\n**AI provider, if AI was involved** (no keys):\n\n**Steps to reproduce**\n1.\n2.\n\n**Expected:**\n**Actual result and exact error message:**\n**Does it happen every time?**\n\nPlease do not paste your writing, research files or API keys. A short invented sample that shows the problem is enough.`
    : `**App version:** ${info.version} · ${info.os}\n**What you write in it** (blog posts, stories, a book…):\n**Most useful part:**\n**A step that slowed you down or surprised you:**\n**If you could change one thing:**\n\nYour writing is not needed. English and Turkish are welcome.`
  const params = new URLSearchParams({ title: kind === 'bug' ? '[Bug] ' : '[Feedback] ', labels: kind, body })
  return `${REPO_URL}/issues/new?${params}`
}
