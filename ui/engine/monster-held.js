// Weapons and things a humanoid holds. `grip` is the pixel put on the hand (the main hand unless
// `hand` says `off`), drawn as a fist `n`, so an item sits in the hand on every build. Items reach
// up and out from the hand and at most two rows below it. Original drawings.

const held = (grip, rows, hand = 'main') => ({ grip, rows, hand })
const item = (...pieces) => ({ slot: 'held', pieces })

export const HELD_PARTS = {
  club: item(held([2, 6], [
    '.ww.',
    'wWww',
    'wwWw',
    '.wW.',
    '..w.',
    '..w.',
    '..n.'
  ])),
  axe: item(held([3, 7], [
    '.m...',
    'mlm..',
    'mlMw.',
    'mlmw.',
    '.mMw.',
    '...w.',
    '...w.',
    '...n.',
    '...w.'
  ])),
  sword: item(held([1, 7], [
    '.l.',
    '.l.',
    '.l.',
    '.l.',
    '.l.',
    '.l.',
    'MaM',
    '.n.',
    '.a.'
  ])),
  spear: item(held([1, 10], [
    '.l.',
    'lMl',
    '.m.',
    '.w.',
    '.w.',
    '.w.',
    '.w.',
    '.w.',
    '.w.',
    '.w.',
    '.n.',
    '.w.',
    '.w.'
  ])),
  bow: item(held([0, 5], [
    '..w.',
    '.w.b',
    'w..b',
    'w..b',
    'w..b',
    'n..b',
    'w..b',
    'w..b',
    '.w.b',
    '..w.'
  ])),
  staff: item(held([1, 10], [
    '.g.',
    'geg',
    'wew',
    '.w.',
    '.w.',
    '.w.',
    '.w.',
    '.w.',
    '.w.',
    '.w.',
    '.n.',
    '.w.',
    '.w.'
  ])),
  dagger: item(held([1, 3], [
    '.l.',
    '.l.',
    'MmM',
    '.n.'
  ])),
  'mace-shield': item(
    held([1, 5], [
      '.l.',
      'lmM',
      '.M.',
      '.w.',
      '.w.',
      '.n.'
    ]),
    held([2, 2], [
      'mmmmm',
      'maaAm',
      'malAm',
      'maaAm',
      '.mAm.',
      '..m..'
    ], 'off')
  ),
  torch: item(held([1, 5], [
    '.f.',
    'fFf',
    'FfF',
    '.W.',
    '.w.',
    '.n.',
    '.w.'
  ])),
  scythe: item(held([4, 10], [
    '.lllw',
    'll..w',
    'l...w',
    '....w',
    '....w',
    '....w',
    '....w',
    '....w',
    '....w',
    '....w',
    '....n',
    '....w',
    '....w'
  ])),
  hammer: item(held([1, 6], [
    'mmm',
    'lmM',
    'mmm',
    '.w.',
    '.w.',
    '.w.',
    '.n.',
    '.w.'
  ]))
}
