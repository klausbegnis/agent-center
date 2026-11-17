// The game's pixel icons: skills, materials, classes, item slots, group upgrades, stars and coins. Each
// is a 10 × 10 grid in two inks, `a` and `b`, with colours of its own, so a list can be scanned
// by colour and by shape. Original drawings, neutral to every room theme. Never touches the DOM.
import { pixelPath } from './pixel-art.js'

/** The side of every icon's grid. */
export const ICON_GRID = 10
/** The inks an icon is drawn in, back to front. */
export const ICON_INKS = ['a', 'b']

/**
 * @typedef {{ rows: string[], colors: { a: string, b?: string } }} Icon
 */

/** @type {Record<string, Icon>} */
export const ICONS = {
  // Work skills.
  forge: {
    colors: { a: '#F8D56B', b: '#C96A42' },
    rows: ['.b...b....', '..b.b.....', 'aaaaaaaaa.', '.aaaaaaaaa', '...aaaaa..', '....aaa...', '...aaaaa..',
      '..aaaaaaa.', '..bbbbbbb.', '..........']
  },
  lore: {
    colors: { a: '#7FB2FF', b: '#E8EAF0' },
    rows: ['..........', '.aaa..aaa.', 'abbbaabbba', 'abbbaabbba', 'abbbaabbba', 'abbbaabbba', 'abbbaabbba',
      'aaaaaaaaaa', '....aa....', '..........']
  },
  engineering: {
    colors: { a: '#6FE0D2', b: '#9AA3B2' },
    rows: ['......aa..', '.....aaa.a', '......aaaa', '.....aaaa.', '....aaa...', '...aaa....', '..aaa.....',
      '.bba......', 'bbb.......', '.b........']
  },
  arcana: {
    colors: { a: '#B9A6F2', b: '#F8D56B' },
    rows: ['..........', '...aaaa...', '.aa....aa.', 'a...bb...a', 'a..bbbb..a', 'a...bb...a', '.aa....aa.',
      '...aaaa...', '..........', '..........']
  },
  command: {
    colors: { a: '#F7B79A', b: '#C96A42' },
    rows: ['b.........', 'baaaaaaa..', 'baaaaaaaa.', 'baaaaaaa..', 'baaaaaa...', 'b.........', 'b.........',
      'b.........', 'b.........', 'bb........']
  },
  // Gathering skills.
  mining: {
    colors: { a: '#C3C9D4', b: '#D9A066' },
    rows: ['..aaaaaa..', '.aaaaaaaa.', 'aa..bb..aa', 'a...bb...a', '....bb....', '....bb....', '....bb....',
      '....bb....', '....bb....', '..........']
  },
  fishing: {
    colors: { a: '#7FD0F0', b: '#D9A066' },
    rows: ['.......b..', '......b.a.', '.....b..a.', '....b...a.', '...b....a.', '..b.....a.', '.b....a.a.',
      'b.....aaa.', '..........', '..........']
  },
  farming: {
    colors: { a: '#9BD67A', b: '#B07A4A' },
    rows: ['..........', 'aaa....aaa', 'aaaa..aaaa', '.aaaa.aaa.', '...aaaa...', '....aa....', '....aa....',
      '.bbbbbbbb.', 'bbbbbbbbbb', '..........']
  },
  woodcutting: {
    colors: { a: '#D9A066', b: '#C3C9D4' },
    rows: ['..bb......', '.bbbb.....', 'bbbbba....', 'bbbbbaa...', '.bbb..aa..', '..b....aa.', '........aa',
      '.........a', '..........', '..........']
  },
  hunting: {
    colors: { a: '#F08A5D', b: '#E8EAF0' },
    rows: ['..aa......', '.a..b.....', 'a...b.....', 'a...b...b.', 'a...bbbbbb', 'a...b...b.', 'a...b.....',
      '.a..b.....', '..aa......', '..........']
  },
  runecraft: {
    colors: { a: '#C39BE0', b: '#9AA3B2' },
    rows: ['........b.', '.......bb.', '......bb..', '.....b....', '.aaaaaa...', '.a....a...', '.a.aa.a...',
      '.a..a.a...', '.a....a...', '.aaaaaa...']
  },
  // Materials: the five work ones, then the six gathering ones.
  bars: {
    colors: { a: '#F8D56B', b: '#C99A2E' },
    rows: ['..........', '..........', '..aaaaaa..', '.aaaaaaaa.', 'bbbbbbbbbb', 'bbbbbbbbbb', '.bbbbbbbb.',
      '..........', '..........', '..........']
  },
  pages: {
    colors: { a: '#E8EAF0', b: '#7FB2FF' },
    rows: ['.aaaaaa...', '.aaaaaaa..', '.abbbbaaa.', '.aaaaaaaa.', '.abbbbbba.', '.aaaaaaaa.', '.abbbbbba.',
      '.aaaaaaaa.', '.abbbbaaa.', '.aaaaaaaa.']
  },
  gears: {
    colors: { a: '#6FE0D2', b: '#2F7F76' },
    rows: ['....aa....', '.aa.aa.aa.', '.aaaaaaaa.', '..aabbaa..', 'aaabbbbaaa', 'aaabbbbaaa', '..aabbaa..',
      '.aaaaaaaa.', '.aa.aa.aa.', '....aa....']
  },
  crystals: {
    colors: { a: '#B9A6F2', b: '#E8EAF0' },
    rows: ['....a.....', '...aab....', '..aaabb...', '..aaabb.a.', '.aaaabbab.', '.aaaabbabb', '.aaaabbabb',
      '..aaabb.b.', '...aab....', '....a.....']
  },
  seals: {
    colors: { a: '#E25B5B', b: '#F7B79A' },
    rows: ['...aaaa...', '..aaaaaa..', '.aaabbaaa.', '.aabaabaa.', '.aabaabaa.', '.aaabbaaa.', '..aaaaaa..',
      '...aaaa...', '..bb..bb..', '.bb....bb.']
  },
  ore: {
    colors: { a: '#9AA3B2', b: '#F8D56B' },
    rows: ['..........', '...aaaa...', '..aaabaa..', '.aaaaaaaa.', '.abaaaaba.', 'aaaaabaaaa', 'aaaaaaaaaa',
      'aabaaaaaba', '.aaaaaaaa.', '..........']
  },
  fish: {
    colors: { a: '#7FD0F0', b: '#2F6F8F' },
    rows: ['..........', '..........', '...aaaa...', '.aaaaaaa.b', 'abaaaaaabb', 'aaaaaaaabb', '.aaaaaaa.b',
      '...aaaa...', '..........', '..........']
  },
  crops: {
    colors: { a: '#E8C35A', b: '#9BD67A' },
    rows: ['..a....a..', '.aaa..aaa.', '.aaa..aaa.', '..a....a..', '..b....b..', '...b..b...', '....bb....',
      '....bb....', '...bbbb...', '....bb....']
  },
  logs: {
    colors: { a: '#E8C08A', b: '#8A5A33' },
    rows: ['..........', '.bbbbbbaa.', 'bbbbbbaaaa', 'bbbbbbaaaa', '.bbbbbbaa.', '..........', '.bbbbbbaa.',
      'bbbbbbaaaa', 'bbbbbbaaaa', '.bbbbbbaa.']
  },
  hides: {
    colors: { a: '#C98F62', b: '#7A4E2E' },
    rows: ['a........a', 'aa.aaaa.aa', '.aaaaaaaa.', '..aabbaa..', '..abbbba..', '..abbbba..', '..aabbaa..',
      '.aaaaaaaa.', 'aa.aaaa.aa', 'a........a']
  },
  runes: {
    colors: { a: '#7C8798', b: '#C39BE0' },
    rows: ['..aaaaaa..', '.aaaaaaaa.', '.aabaabaa.', '.aabbbbaa.', '.aaabaaaa.', '.aaabaaaa.', '.aabbbaaa.',
      '.aaaaaaaa.', '..aaaaaa..', '..........']
  },
  // Classes.
  physical: {
    colors: { a: '#E8EAF0', b: '#D9A066' },
    rows: ['........aa', '.......aaa', '......aaa.', '.....aaa..', '....aaa...', '.b.aaa....', '..bba.....',
      '..bb......', '.b..b.....', 'b.........']
  },
  magical: {
    colors: { a: '#C9A6FF', b: '#F8D56B' },
    rows: ['....aa....', '....aa....', '...abba...', '.aabbbbaa.', 'aabbbbbbaa', 'aabbbbbbaa', '.aabbbbaa.',
      '...abba...', '....aa....', '....aa....']
  },
  defense: {
    colors: { a: '#7FB2FF', b: '#E8EAF0' },
    rows: ['.aaaaaaaa.', '.aaabbaaa.', '.aaabbaaa.', '.abbbbbba.', '.aaabbaaa.', '.aaabbaaa.', '..aabbaa..',
      '..aaaaaa..', '...aaaa...', '....aa....']
  },
  support: {
    colors: { a: '#6FCF7F', b: '#E8F8E0' },
    rows: ['...aaaa...', '...abba...', '...abba...', 'aaaabbaaaa', 'abbbbbbbba', 'abbbbbbbba', 'aaaabbaaaa',
      '...abba...', '...abba...', '...aaaa...']
  },
  // Item slots; a weapon is drawn by the kind of damage it deals.
  'weapon-physical': {
    colors: { a: '#C3C9D4', b: '#B07A4A' },
    rows: ['...a..a...', '..aaaaaa..', '.aaaaaaaa.', '..aaaaaa..', '....bb....', '....bb....', '....bb....',
      '....bb....', '...bbbb...', '....bb....']
  },
  'weapon-magical': {
    colors: { a: '#E0B8FF', b: '#B07A4A' },
    rows: ['.......a..', '......aaa.', '.......a..', '......b...', '.....b....', '....bb....', '...bb.....',
      '..bb......', '.bb.......', '..........']
  },
  outfit: {
    colors: { a: '#E8956B', b: '#F8D56B' },
    rows: ['..aa..aa..', '.aaaaaaaa.', 'aaaaaaaaaa', 'aa.aaaa.aa', '...aaaa...', '...bbbb...', '...aaaa...',
      '..aaaaaa..', '..aaaaaa..', '..........']
  },
  tool: {
    colors: { a: '#AEB6C2', b: '#8A5A33' },
    rows: ['...bbbb...', '....bb....', '....bb....', '....bb....', '....bb....', '..aaaaaa..', '..aaaaaa..',
      '..aaaaaa..', '...aaaa...', '....aa....']
  },
  // Group upgrades.
  campfire: {
    colors: { a: '#F08A5D', b: '#8A5A33' },
    rows: ['....a.....', '...aa.....', '...aaa.a..', '..aaaaaa..', '..aaaaaa..', '...aaaa...', '..........',
      'bb......bb', '.bbbbbbbb.', 'bb......bb']
  },
  workbench: {
    colors: { a: '#D9A066', b: '#C3C9D4' },
    rows: ['..........', '.bb.......', '.bb...bbb.', 'aaaaaaaaaa', 'aaaaaaaaaa', '.a......a.', '.a......a.',
      '.aaaaaaaa.', '.a......a.', '.a......a.']
  },
  runeCircle: {
    colors: { a: '#C39BE0', b: '#6FE0D2' },
    rows: ['...aaaa...', '.aa....aa.', '.a......a.', 'a...bb...a', 'a..b..b..a', 'a..b..b..a', 'a...bb...a',
      '.a......a.', '.aa....aa.', '...aaaa...']
  },
  // The game's tabs that have no icon of their own elsewhere: a room's door, a party, a chest.
  'tab-rooms': {
    colors: { a: '#C9A26B', b: '#6B4A2B' },
    rows: ['....aa....', '...aaaa...', '..aaaaaa..', '.aaaaaaaa.', 'aaaaaaaaaa', '.a......a.', '.a.bbbb.a.',
      '.a.bbbb.a.', '.a.bbbb.a.', '.aaaaaaaa.']
  },
  'tab-party': {
    colors: { a: '#8FD3C8', b: '#E8C07A' },
    rows: ['..b....a..', '.bbb..aaa.', '.bbb..aaa.', '..b....a..', '.bbb..aaa.', 'bbbbbaaaaa', 'bbbbbaaaaa',
      '.bbb..aaa.', '.b.b..a.a.', '.b.b..a.a.']
  },
  'tab-chest': {
    colors: { a: '#B9773A', b: '#F2C14E' },
    rows: ['..........', '.aaaaaaaa.', 'aaaaaaaaaa', 'aaaaaaaaaa', 'bbbbbbbbbb', 'aaaabbaaaa', 'aaaabbaaaa',
      'aaaaaaaaaa', 'aaaaaaaaaa', '..........']
  },
  // A coin of the market, with its stamped mark.
  coin: {
    colors: { a: '#F2C14E', b: '#A8741A' },
    rows: ['...aaaa...', '.aaaaaaaa.', '.aabbbbaa.', 'aabaaaabaa', 'aabaabaaaa', 'aabaabaaaa', 'aabaaaabaa',
      '.aabbbbaa.', '.aaaaaaaa.', '...aaaa...']
  },
  // A prestige star.
  star: {
    colors: { a: '#F2C14E' },
    rows: ['....aa....', '....aa....', '...aaaa...', 'aaaaaaaaaa', '.aaaaaaaa.', '..aaaaaa..', '..aaaaaa..',
      '.aaa..aaa.', '.aa....aa.', '..........']
  }
}

/** The icon of an item slot: a weapon by its damage type, the others by their slot. */
export function slotIconId(slot, damageType) {
  if (slot === 'weapon') return damageType === 'magical' ? 'weapon-magical' : 'weapon-physical'
  return slot
}

/**
 * What an icon is drawn with: one path per ink with its colour, or null for an id with no icon.
 *
 * @param {string} id
 * @returns {null | { viewBox: string, paths: { color: string, d: string }[] }}
 */
export function iconPaths(id) {
  const icon = Object.hasOwn(ICONS, id) ? ICONS[id] : null
  if (!icon) return null
  const paths = ICON_INKS
    .filter((ink) => icon.colors[ink])
    .map((ink) => ({ color: icon.colors[ink], d: pixelPath(icon.rows, ink) }))
    .filter((path) => path.d)
  return { viewBox: `0 0 ${ICON_GRID} ${ICON_GRID}`, paths }
}

/** An icon's main colour, for a bar or a tile that goes with it; null for an id with no icon. */
export function iconColor(id) {
  return Object.hasOwn(ICONS, id) ? ICONS[id].colors.a : null
}
