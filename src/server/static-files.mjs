// Serves the plugin's own UI and theme files to the external view. Nothing else on disk is
// reachable: a path that resolves outside ui/ or themes/ is refused.
import fs from 'node:fs'
import path from 'node:path'

export const CONTENT_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.woff2': 'font/woff2'
}

const PUBLIC_FOLDERS = ['ui', 'themes']

/**
 * What a page served here may load: this server's own files and nothing inline that can run.
 * A theme's sprite sheet is inserted as markup, so this is what keeps an event handler hidden
 * in one from running in the external view. Styles stay open because sprites carry them.
 */
const PAGE_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data:",
  "connect-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-ancestors 'none'"
].join('; ')

/**
 * Everything else is data for that page. Opened by itself as a document (an SVG can be), it may
 * run nothing and reach nothing.
 */
const FILE_POLICY = "default-src 'none'; style-src 'unsafe-inline'; img-src 'self' data:; sandbox; frame-ancestors 'none'"

export function send(response, status, body, type = 'text/plain; charset=utf-8') {
  response.writeHead(status, {
    'content-type': type,
    'cache-control': 'no-store',
    // Files are used as the type they are sent with, and only by this server's own page.
    'x-content-type-options': 'nosniff',
    'cross-origin-resource-policy': 'same-origin',
    'content-security-policy': type.startsWith('text/html') ? PAGE_POLICY : FILE_POLICY
  })
  response.end(body)
}

export function sendJson(response, status, value) {
  send(response, status, JSON.stringify(value), CONTENT_TYPES['.json'])
}

/**
 * @param {import('node:http').ServerResponse} response
 * @param {string} root the plugin folder
 * @param {string} relativePath path under the plugin folder, such as `ui/web.html`
 */
export function serveFile(response, root, relativePath) {
  const file = path.normalize(path.join(root, relativePath))
  const isPublic = PUBLIC_FOLDERS.some((folder) => file.startsWith(path.join(root, folder) + path.sep))
  if (!isPublic) return send(response, 403, 'forbidden')

  const type = CONTENT_TYPES[path.extname(file).toLowerCase()] ?? 'application/octet-stream'
  try {
    // A link inside a public folder must not lead out of it.
    const real = fs.realpathSync(file)
    const realRoot = fs.realpathSync(root)
    const staysInside = PUBLIC_FOLDERS.some((folder) => real.startsWith(path.join(realRoot, folder) + path.sep))
    if (!staysInside) return send(response, 403, 'forbidden')
    fs.readFile(real, (error, data) => {
      if (error) return send(response, 404, 'not found')
      send(response, 200, data, type)
    })
  } catch {
    // A file that is not there, or a path the file system cannot even try.
    send(response, 404, 'not found')
  }
}
