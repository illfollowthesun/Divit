import { resolve } from 'node:path'
import { queued } from './research-bridge.mjs'

// The browser preview keeps research as real files under .tmp/yazi-preview, so the inbox can be tried.
export const previewDataRoot = resolve('.tmp/yazi-preview')
export function previewResearch() {
  return { name: 'yazi-local-research', configureServer(server) {
    server.middlewares.use('/__yazi/research', async (req, res) => {
      const send = (status, value) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value ?? null)) }
      if (!/^(127\.0\.0\.1|localhost):\d+$/.test(req.headers.host ?? '')) return send(403, { error: 'Local preview only.' })
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return send(403, { error: 'Use the local preview window.' })
      if (req.method !== 'POST' || req.headers['x-yazi-preview'] !== '1') return send(405, { error: 'Use the research panel in the preview.' })
      try {
        let raw = '', length = 0
        for await (const chunk of req) { length += chunk.length; if (length > 3 * 1024 * 1024) return send(413, { error: 'This source is too large for the preview.' }); raw += chunk }
        send(200, await queued({ ...JSON.parse(raw), dataRoot: previewDataRoot, createProject: true }))
      } catch (error) { send(400, { error: error.message }) }
    })
  } }
}
