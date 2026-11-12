// Decides whether the external view may answer a request. The page has no login, so two things
// keep other websites away from it: the Host a request names must be this machine, and a
// request to the API must come from the page itself.
import net from 'node:net'

const LOOPBACK_NAMES = ['localhost', '127.0.0.1', '[::1]']

/**
 * The decoded path of a request target, or null when the target is malformed. A path with a
 * NUL character counts as malformed: no file has one, and the file system calls throw on it.
 *
 * @param {string | undefined} target the request line's target, such as `/ui/stage.css?x=1`
 * @returns {string | null}
 */
export function pathnameOf(target) {
  try {
    const pathname = decodeURIComponent(new URL(target ?? '/', 'http://localhost').pathname)
    return pathname.includes('\0') ? null : pathname
  } catch {
    return null
  }
}

/** The host name of a `Host` header without its port, lower case, or null when malformed. */
function hostNameOf(hostHeader) {
  if (typeof hostHeader !== 'string') return null
  // A name or an IPv4 address, or an IPv6 address in brackets, then an optional port. Anything
  // looser (user@host, a path, a number standing for an address) is not what a browser sends.
  const match = /^(\[[0-9a-f:.]+\]|[a-z0-9]([a-z0-9.-]*[a-z0-9])?)(:\d{1,5})?$/i.exec(hostHeader)
  return match ? match[1].toLowerCase() : null
}

const isIpLiteral = (name) => net.isIP(name.replace(/^\[|\]$/g, '')) !== 0

/**
 * Whether the `Host` header names this machine. A website that points its own domain at this
 * machine (DNS rebinding) still sends its domain here, and is refused. On the local network the
 * page is reached by address or by the machine's name, so those are accepted too.
 *
 * @param {string | undefined} hostHeader
 * @param {{ lan: boolean, machineNames?: string[] }} options
 */
export function isAllowedHost(hostHeader, { lan, machineNames = [] }) {
  const name = hostNameOf(hostHeader)
  if (name === null) return false
  if (LOOPBACK_NAMES.includes(name)) return true
  if (!lan) return false
  return isIpLiteral(name) || machineNames.map((item) => item.toLowerCase()).includes(name)
}

/**
 * Whether a request comes from the page this server served, or from no page at all (a command
 * line tool). Browsers add `Origin` to every request another site makes that could change
 * something, and `Sec-Fetch-Site` to all of them.
 *
 * @param {import('node:http').IncomingHttpHeaders} headers
 */
export function isSameOrigin(headers) {
  if (headers['sec-fetch-site'] === 'cross-site') return false
  const origin = headers.origin
  if (origin === undefined) return true
  try {
    return new URL(origin).host === headers.host
  } catch {
    return false
  }
}
