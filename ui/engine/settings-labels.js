// The wording of the game's settings and of their "Save file" card, apart from the rest of the
// wording in labels.js, which had grown well past the size a module should have.
export const SETTINGS = {
  open: 'Game settings',
  title: 'Game settings',
  close: 'Close',
  keepTitles: 'Keep session titles',
  keepTitlesHint: 'Off: a retiree keeps only a generated name, its level and what it did. Turning it off ' +
    'forgets the titles already kept.',
  travel: 'New scene after each monster',
  travelHint: 'Each room that plays and has no theme of its own moves to another theme when its ' +
    'monster dies, as if the party travelled on. Its monsters fit the scene.',
  worlds: 'Worlds',
  worldsNote: 'Each world keeps its own skills, materials and upgrades. A room out of the game counts ' +
    'no tokens.',
  roomWorld: (room) => `World for the ${room} room`,
  outOfGame: 'Out of the game',
  newWorld: 'New world…',
  newWorldName: 'Name of the new world',
  create: 'Create',
  cancel: 'Cancel',
  newWorldError: {
    empty: 'Give the world a name with at least one letter or digit.',
    taken: 'There is already a world with that name.',
    full: 'There are already eight worlds, the most there can be.'
  },
  reset: 'Reset this world',
  resetWorld: 'World to reset',
  resetQuestion: (worldId) => `Reset world "${worldId}"? Its skills, materials and group upgrades, and ` +
    'every room\'s wave, chest and retirees in it, go back to the start. This cannot be undone.',
  resetConfirm: (worldId) => `Reset ${worldId}`,
  local: 'Everything stays on this computer.'
}

/** The "Save file" card of the game settings: export the game, or import one in its place. */
export const SAVE_FILE = {
  title: 'Save file',
  note: 'Keep a copy of the game, or carry it to another computer. Token counts are not in the ' +
    'file: after an import, counting starts again from now.',
  export: 'Export',
  exporting: 'Exporting…',
  exported: 'A download of the file was started. If none came, copy the text below and keep it in a file.',
  exportText: 'Exported save file',
  copy: 'Copy',
  copied: 'Copied.',
  copySelected: 'The text is selected: press Ctrl+C or ⌘C to copy it.',
  import: 'Import',
  importFile: 'Save file to import',
  importText: 'Or paste a save file here',
  importQuestion: 'Replace the whole game with this file? All progress on this computer, in every ' +
    'world, is replaced by the file\'s. This cannot be undone.',
  importConfirm: 'Replace the game',
  imported: 'The game was replaced by the file.',
  readFailed: 'The file could not be read.',
  textError: {
    empty: 'Choose a file or paste a save file first.',
    invalid: 'This is not valid JSON, so it cannot be a save file.',
    notObject: 'This is not a save file: it should be one JSON object.'
  }
}

/** The marker by the tabs on a page opened from another machine, and what it means. */
export const VIEW_ONLY_MARKER = 'View only'
export const VIEW_ONLY_NOTE = 'This page is open from another machine on the network. The game can be ' +
  'watched here, and played only on the computer that runs Orca.'

/** "main · level 11" as a choice of world. */
export const worldChoice = (world) => `${world.id} · level ${world.level}`
