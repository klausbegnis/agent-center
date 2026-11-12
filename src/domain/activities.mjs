// Which activity a character acts out for each tool an agent uses.

const TOOLS_BY_ACTIVITY = {
  write: ['Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'apply_patch'],
  read: ['Read', 'Grep', 'Glob', 'LS', 'WebFetch', 'WebSearch', 'ToolSearch'],
  run: ['Bash', 'BashOutput', 'KillShell', 'shell', 'exec_command']
}

/** Tools that start a subagent. */
const DELEGATE_TOOLS = new Set(['Agent', 'Task'])

/** Activity shown while an agent works with a tool this module does not know. */
const UNKNOWN_TOOL_ACTIVITY = 'think'

const ACTIVITY_BY_TOOL = new Map(
  Object.entries(TOOLS_BY_ACTIVITY).flatMap(([activity, tools]) =>
    tools.map((tool) => [tool.toLowerCase(), activity])
  )
)

export function activityForTool(tool) {
  return ACTIVITY_BY_TOOL.get(String(tool ?? '').toLowerCase()) ?? UNKNOWN_TOOL_ACTIVITY
}

export function isDelegateTool(tool) {
  return DELEGATE_TOOLS.has(String(tool ?? ''))
}
