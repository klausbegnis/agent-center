// Golems and treants, facing the party. A golem is legs, torso, arms and head meeting at fixed
// joints (neck at row 8, shoulders at rows 8 to 10, hips at row 17); a treant is roots, trunk,
// crown and a face cut into the trunk around rows 12 to 15. Drawn on the whole 24-pixel grid
// (`at` is the top left corner). Original drawings.

const part = (slot, at, rows) => ({ slot, rows, at })
const marking = (from, to, pattern) => ({ slot: 'extras', paint: { from, to, pattern, region: 'all' } })
const piece = (layer, at, rows, outline = false) => ({ slot: 'extras', layer, outline, rows, at })

export const CONSTRUCT_PARTS = {
  'golem-legs-pillars': part('legs', [6, 17], [
    '..ssssSSSS..',
    '.sssS..ssSS.',
    '.sssS..ssSS.',
    '.sssS..ssSS.',
    'SSSSS..SSSSS',
    'SSSSS..SSSSS'
  ]),
  'golem-legs-stumps': part('legs', [5, 17], [
    '...sssSSSS....',
    '..ssssSSSSS...',
    '.sssSS..sssSS.',
    '.sssSS..sssSS.',
    'SSSSSS..SSSSSS',
    'SSSSSS..SSSSSS'
  ]),
  'golem-torso-block': part('torso', [5, 8], [
    '..hhhhhhhhhh..',
    '.hssssssssssS.',
    '.hsssssssssSS.',
    '.ssssSSsssssS.',
    '.sssssssssssS.',
    '.sssssssSsssS.',
    '.ssssssssssSS.',
    '.SsssssssssSS.',
    '..SSSSSSSSSS..',
    '...SSSSSSSS...'
  ]),
  'golem-torso-barrel': part('torso', [5, 8], [
    '...hhhhhhhh...',
    '..hssssssssS..',
    '.hsbbbbbbbbsS.',
    '.ssssssssssSS.',
    '.ssssssssssSS.',
    '.sbbbbbbbbbbS.',
    '.ssssssssssSS.',
    '..sssssssssS..',
    '..SbbbbbbbbS..',
    '...SSSSSSSS...'
  ]),
  'golem-torso-hunched': part('torso', [4, 8], [
    '...hhhhhhhhhh...',
    '.hhssssssssssSS.',
    'hsssssssssssssSS',
    'sssssssssssssSSS',
    '.sssssSSssssSSS.',
    '..ssssssssssSS..',
    '..sssssssssSSS..',
    '...SssssssSSS...',
    '...SSSSSSSSSS...',
    '....SSSSSSSS....'
  ]),
  'golem-arms-fists': part('arms', [1, 8], [
    '.hhhh..........hhhh.',
    'hssss..........ssssS',
    'hsssS..........sssSS',
    '.ssS............sSS.',
    '.ssS............sSS.',
    '.ssS............sSS.',
    'hsssS..........hsssS',
    'sssssS........sssssS',
    'sssssS........sssssS',
    'SsSsSS........SsSsSS',
    '.SSSS..........SSSS.'
  ]),
  'golem-arms-slabs': part('arms', [1, 8], [
    'hhhhh..........hhhhh',
    'hssss..........sssSS',
    'sssss..........sssSS',
    'sssss..........sssSS',
    'ssssS..........sssSS',
    'ssssS..........sssSS',
    'ssssS..........sssSS',
    'SSSSS..........SSSSS',
    '.S.S............S.S.'
  ]),
  'golem-head-slab': part('head', [8, 3], [
    '.hhhhhh.',
    'hssssssS',
    'sgessegS',
    'ssssssSS',
    'SSSSSSSS'
  ]),
  'golem-head-dome': part('head', [8, 3], [
    '..hhhh..',
    '.hssssS.',
    'hssssssS',
    'segssgeS',
    'SSSSSSSS'
  ]),
  'golem-head-horned': part('head', [7, 1], [
    'b........b',
    'bb......bb',
    '.bhhhhhhb.',
    '.hssssssS.',
    '.seg..geS.',
    '.ssssssSS.',
    '.SSSSSSSS.'
  ]),
  'golem-runes': marking(['s'], 'g', 'spots'),
  'golem-cracks': marking(['s', 'h'], 'p', 'spots'),
  'golem-bands': marking(['s'], 'm', 'bands'),
  'golem-chains': piece('front', [6, 9], [
    'mM..........',
    '..mM........',
    '....mM......',
    '......mM....',
    '........mM..',
    '..........mM'
  ]),

  'treant-roots-spread': part('roots', [3, 19], [
    '......wwwwWW......',
    '...wwwwwWWWWWW....',
    '.wwwW.wwWW.WWwwW..',
    'wW...wW......WW.wW'
  ]),
  'treant-roots-gnarled': part('roots', [3, 19], [
    '.....wwwwwWW......',
    '..wwwwwwWWWWWW....',
    'wwW..wwW..WWW.wwW.',
    'W...wW.....WW...WW'
  ]),
  'treant-trunk-stout': part('trunk', [5, 9], [
    'w............W',
    'ww....wWW...WW',
    '.ww..wwwWW.WW.',
    '..wwwwwwwWWW..',
    '...wwwwwwWW...',
    '...wwwwwwWW...',
    '...wwwwwwWW...',
    '...wwwwwwWW...',
    '...wwwwwwWW...',
    '...wwwwwwWW...',
    '..wwwwwwwWWW..'
  ]),
  'treant-trunk-twisted': part('trunk', [5, 9], [
    '.w..........W.',
    'ww....wW...WW.',
    '.wwwwwwwW.WW..',
    '...wwwwwwWW...',
    '...wwwwwwWW...',
    '..wwwwwwwWW...',
    '..wwwwwwwWWW..',
    '...wwwwwwWWW..',
    '...wwwwwwWW...',
    '..wwwwwwwWW...',
    '..wwwwwwwWWW..'
  ]),
  'treant-trunk-hollow': part('trunk', [5, 9], [
    'W............W',
    'ww...wwWW...WW',
    '.ww.wwwwWW.WW.',
    '..wwwwwwwWWW..',
    '...wwwwwwWW...',
    '...wwwwwwWW...',
    '...wwwwwwWW...',
    '...wwpppwWW...',
    '...wppppwWW...',
    '...wwppwwWW...',
    '..wwwwwwwWWW..'
  ]),
  'treant-crown-leafy': part('crown', [3, 1], [
    '......rrrrrr......',
    '...rrrRrrrrrRrr...',
    '..rrrrrrrRrrrrrr..',
    '.rrRrrrrrrrrrRrrr.',
    'rrrrrrRrrrrrrrrrRr',
    'rrrRrrrrrrRrrrrrrr',
    'rRrrrrrrrrrrrrRrrR',
    '.rrrRrrRrrrrrrrrR.',
    '..RRrrRRrrRRrrRR..',
    '...RR..RR..RR.....'
  ]),
  'treant-crown-bare': part('crown', [3, 2], [
    '..w.....w....w....',
    '..ww...w....w..w..',
    '...ww..w...ww.w...',
    'w...w.ww..w...w..w',
    '.w...www.ww..ww.w.',
    '..ww..wwww..ww.ww.',
    '....wwwwwwwww.....',
    '......wwwwW.......'
  ]),
  'treant-crown-pine': part('crown', [5, 0], [
    '......rr......',
    '.....rrRr.....',
    '....rrrrRr....',
    '...rrRrrrRr...',
    '....rrrrRr....',
    '..rrrRrrrrRr..',
    '.rrrrrrRrrrRr.',
    '...rrRrrrrr...',
    '.rrrrrrrRrrrr.',
    'rrRrrrrrrrRrrr',
    '..RRRRRRRRRR..'
  ]),
  'treant-face-knots': part('face', [9, 12], [
    'pp..pp',
    'pe..ep',
    '......',
    '.pppp.'
  ]),
  'treant-face-scowl': part('face', [9, 12], [
    'W....W',
    'pe..ep',
    '......',
    '.pbbp.'
  ]),
  'treant-face-sleepy': part('face', [9, 12], [
    '......',
    'pp..pp',
    '......',
    '..pp..'
  ]),
  'treant-mushrooms': piece('front', [5, 15], [
    'aa.......',
    'Ab.......',
    '.........',
    '.......aa',
    '.......Ab'
  ], true),
  'treant-fireflies': piece('front', [1, 4], [
    'g.....................',
    '....................g.',
    '......................',
    '.g....................',
    '...................g..'
  ]),
  'treant-moss': marking(['w', 'W', 'r'], 'v', 'top'),
  'treant-blossoms': marking(['r'], 'a', 'spots')
}
