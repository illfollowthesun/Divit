# Tablet notes (iPad and Android, 0.2+)

Tauri 2 can build for iOS and Android, so a tablet version of Divit is possible later. This file lists what is Windows-only today, so new code avoids adding more of it. It was written during 0.1.0-beta.1.

## Windows-only pieces

| Piece | Where | What a tablet build needs |
|---|---|---|
| **API keys in Windows Credential Manager** | `src-tauri/src/ai.rs`, uses `keyring` with the `windows-native` feature | iOS Keychain / Android Keystore. Use a keyring backend per platform, or a Tauri secure-storage plugin. |
| **Node.js helpers** | `scripts/*-bridge.mjs`, started by `run_bridge` in `src-tauri/src/main.rs` | Not possible on mobile. Port research (page fetch, source files, inbox), backups and site publishing to Rust or to the window. Built-in export already needs no Node. |
| **Documents folder and Windows paths** | `default_root` and `location.rs` in `src-tauri/src`; texts that say `Documents\Divit` | Use the app's own documents folder on mobile. Phrase texts without a Windows path. |
| **Folder choice and verified move** | `location.rs`, Settings → Your files | Mobile folder pickers give scoped access, not paths. Keep the default folder there and hide the move. |
| **Installer and updater** | NSIS/MSI in `tauri.conf.json`; `tauri-plugin-updater` | App stores handle install and updates; turn the updater off on mobile. |
| **Single instance** | `tauri-plugin-single-instance` in `main.rs` | Desktop only; leave it out of mobile builds. |
| **Pandoc export** | `scripts/export-bridge.mjs` | Desktop only. The built-in Word/PDF/Markdown export (`src/projects/builtin-export.ts`) runs in the window and works anywhere. |
| **Windows version in bug reports** | `src/settings/feedback.ts` | Report the platform name more generally. |

## Keep new code tablet-friendly

- **No platform calls in shared UI code.** Go through `src/shared/api.ts`, as the browser preview already does.
- **Touch-sized targets.** Many toolbar and panel buttons are small (10–12 px text, little padding). On a tablet layout, aim for at least 44 × 44 px.
- **No hover-only actions.** Today everything hover shows is also reachable by click or keyboard; keep it that way. The focus and typewriter "chrome appears near the top" behaviour also needs a tap target on touch.
- **Shortcuts are extras.** Every shortcut has a visible control, so a tablet without a keyboard loses nothing.
- **Right-click menus.** The spelling menu also opens by clicking an underlined word; keep a tap path for anything new.
