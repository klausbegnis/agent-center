// Parts only the named bosses of game/bosses.json wear: a great crown for every kind of head,
// a double-bladed axe and a skull staff. Original drawings.

export const BOSS_PARTS = {
  'great-crown': { slot: 'headgear', at: [0, -3], rows: [
    '.a..aa..a.',
    '.aa.aa.aa.',
    '.aaaaaaaa.',
    '.AeAaaAeA.'
  ] },
  'great-crown-slime': { slot: 'extras', layer: 'front', at: [9, 1], rows: [
    'a.aa.a',
    'aaaaaa',
    'AeAAeA'
  ] },
  'great-crown-ghost': { slot: 'extras', layer: 'front', at: [9, 0], rows: [
    'a.aa.a',
    'aaaaaa',
    'AeAAeA'
  ] },
  greataxe: { slot: 'held', pieces: [{ grip: [3, 8], rows: [
    '...l...',
    'mm.w.mm',
    'lmmwmmM',
    'lmmwmmM',
    'mm.w.mm',
    '...w...',
    '...w...',
    '...w...',
    '...n...',
    '...w...'
  ] }] },
  'skull-staff': { slot: 'held', pieces: [{ grip: [2, 11], rows: [
    '.bbb.',
    'bebeb',
    '.bpb.',
    '..w..',
    '..w..',
    '..w..',
    '..w..',
    '..w..',
    '..w..',
    '..w..',
    '..w..',
    '..n..',
    '..w..'
  ] }] }
}
