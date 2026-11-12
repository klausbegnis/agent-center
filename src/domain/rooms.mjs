// How workspaces are grouped into rooms.

export function basename(path) {
  const segments = String(path ?? '')
    .split(/[\\/]/)
    .filter(Boolean)
  return segments[segments.length - 1] ?? ''
}

function isInside(childPath, parentPath) {
  const parent = String(parentPath).replace(/[\\/]+$/, '')
  return childPath.startsWith(`${parent}/`) || childPath.startsWith(`${parent}\\`)
}

function belongTogether(a, b) {
  if ((a.hostId ?? null) !== (b.hostId ?? null)) return false
  const sameRepository = Boolean(a.repoId) && a.repoId === b.repoId
  const nested = isInside(String(a.path), String(b.path)) || isInside(String(b.path), String(a.path))
  return sameRepository || nested
}

/**
 * Groups workspaces into rooms. Two workspaces on the same host share a room when they belong
 * to the same repository (worktrees) or when one sits inside the other's folder, as with an
 * umbrella repository that has others cloned inside. The room is named after the outermost one.
 *
 * @param {{ id: string, path: string, hostId?: string | null, repoId?: string | null,
 *   repoName?: string | null, name?: string }[]} workspaces
 * @returns {Map<string, { id: string, name: string, host: string | null }>} room by workspace id
 */
export function groupRooms(workspaces) {
  // Union-find over workspace ids.
  const parentOf = new Map(workspaces.map((workspace) => [workspace.id, workspace.id]))
  const groupOf = (id) => {
    while (parentOf.get(id) !== id) id = parentOf.get(id)
    return id
  }
  for (let i = 0; i < workspaces.length; i++) {
    for (let j = i + 1; j < workspaces.length; j++) {
      if (belongTogether(workspaces[i], workspaces[j])) {
        parentOf.set(groupOf(workspaces[i].id), groupOf(workspaces[j].id))
      }
    }
  }

  // The outermost workspace of each group, the one with the shortest path, names the room.
  const outermost = new Map()
  for (const workspace of workspaces) {
    const group = groupOf(workspace.id)
    const current = outermost.get(group)
    if (!current || String(workspace.path).length < String(current.path).length) {
      outermost.set(group, workspace)
    }
  }

  const rooms = new Map()
  for (const workspace of workspaces) {
    const root = outermost.get(groupOf(workspace.id))
    rooms.set(workspace.id, {
      id: `${root.hostId ?? 'local'}:${root.path}`,
      name: root.repoName || basename(root.path) || root.name || String(root.id),
      host: root.hostId ?? null
    })
  }
  return rooms
}
