import React from 'react'
import ReactDOM from 'react-dom/client'
import '@fontsource/newsreader/400.css'
import '@fontsource/newsreader/400-italic.css'
import '@fontsource/ibm-plex-sans/400.css'
import '@fontsource/ibm-plex-sans/500.css'
import '@fontsource/ibm-plex-mono/400.css'
import { App } from './App'
import { installRuntimeDiagnostics, recordRuntime } from './shared/runtime-diagnostics'
import './styles.css'
import './polish/chrome.css'
installRuntimeDiagnostics()
ReactDOM.createRoot(document.getElementById('root')!, { onUncaughtError: error => { recordRuntime('react-fatal', error); console.error(error) } }).render(<React.StrictMode><App /></React.StrictMode>)

import './polish/cards.css'

import './polish/outline.css'

import './polish/drawers.css'

import './polish/details.css'

import './polish/backup.css'

import './polish/language.css'

import './polish/diff.css'

import './polish/spelling.css'

import './polish/lines.css'

import './polish/research.css'

import './polish/shell.css'
