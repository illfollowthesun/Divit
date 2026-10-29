import { desktop } from '../shared/api'

// Updates come from the GitHub releases, signed with the project's key; the updater refuses anything
// else. Nothing is downloaded until the writer clicks Install.
export type AvailableUpdate = { version: string; notes: string; install: () => Promise<void> }
export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  if (!desktop) return null
  const { check } = await import('@tauri-apps/plugin-updater')
  const update = await check({ timeout: 20000 })
  if (!update) return null
  return {
    version: update.version, notes: update.body ?? '',
    install: async () => {
      await update.downloadAndInstall()
      const { relaunch } = await import('@tauri-apps/plugin-process'); await relaunch()
    },
  }
}
