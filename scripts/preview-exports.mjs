import { readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { exportTools, exportDocument } from './export-bridge.mjs'
import { previewDataRoot } from './preview-research.mjs'

export function previewExports() {
  return { name: 'yazi-local-exports', configureServer(server) {
    server.middlewares.use('/__yazi/export', async (req, res) => {
      const send = (status, value) => { res.statusCode = status; res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(value)) }
      if (!/^(127\.0\.0\.1|localhost):\d+$/.test(req.headers.host ?? '')) return send(403, { error: 'Local preview only.' })
      if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return send(403, { error: 'Use the local preview window.' })
      try {
        if (req.method === 'GET') return send(200, await exportTools())
        if (req.method !== 'POST' || req.headers['x-yazi-preview'] !== '1') return send(405, { error: 'Use Export in the preview.' })
        // Join raw bytes before decoding so a Turkish letter split across chunks stays intact.
        const chunks = []; let length = 0
        for await (const chunk of req) { length += chunk.length; if (length > 20 * 1024 * 1024) return send(413, { error: 'This preview export is too large. Use the desktop app.' }); chunks.push(chunk) }
        const request = JSON.parse(Buffer.concat(chunks).toString('utf8'))
        const result = await exportDocument({ project: request.project, images: request.images, format: request.format, outputRoot: resolve('.tmp/preview-exports'), includeSources: request.includeSources === true, dataRoot: previewDataRoot })
        res.setHeader('Content-Type', result.format === 'markdown' ? 'text/markdown; charset=utf-8' : 'application/octet-stream')
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`)
        res.end(await readFile(result.path))
      } catch (error) { send(400, { error: error.message }) }
    })
  } }
}
