// Elementals, facing the party: a silhouette for each element (a flame, a column, a vortex, a
// hulk of stone) with a face laid on it around rows 6 to 11, and extras that say the element:
// sparks, drops, stones, gusts. Drawn on the whole 24-pixel grid (`at` is the top left
// corner). Original drawings.

const part = (slot, at, rows) => ({ slot, rows, at })
const marking = (from, to, pattern) => ({ slot: 'extras', paint: { from, to, pattern, region: 'all' } })
const piece = (layer, at, rows, outline = false) => ({ slot: 'extras', layer, outline, rows, at })

export const ELEMENTAL_PARTS = {
  'elemental-column': part('body', [5, 3], [
    '......hh......',
    '.....hssS.....',
    '....hssssS....',
    '...hssssssS...',
    '...ssssssSS...',
    '...ssssssSS...',
    '.hhsssssssShh.',
    'hsssssssssssSS',
    'sS.ssssssSS.SS',
    'sS.ssssssSS.SS',
    'sS.ssssssSS.SS',
    'hh.ssssssSS.hh',
    '...ssssssSS...',
    '...ssssssSS...',
    '..sssssssSSS..',
    '.ssssssssSSSS.',
    'sssssssssSSSSS',
    '.SSSSSSSSSSSS.',
    '..S..S..S..S..',
    '..............'
  ]),
  'elemental-flame': part('body', [5, 4], [
    '.....h....h...',
    '....hs...hs...',
    '....hss.hsS..h',
    '...hsssshssS.s',
    '..hsssssssssSs',
    '..sssssssssSS.',
    '.hssssssssssS.',
    'hsssssssssssSS',
    'sS.sssssssSS.S',
    'sS.sssssssSS.S',
    'hh.ssssssSSS.h',
    '...ssssssSSS..',
    '...sssssssSS..',
    '..ssssssssSSS.',
    '.sssssssssSSSS',
    'sssssssssssSSS',
    '.SsSssSssSsSS.',
    '..S..S..S..S..'
  ]),
  'elemental-vortex': part('body', [3, 3], [
    '..hhhhhhhhhhhhhh..',
    '.hssssssssssssssS.',
    '..SSSSssssssSSSS..',
    '...hhssssssssSS...',
    '....sssssssssS....',
    '...SSSSssssSSS....',
    '.....hsssssSS.....',
    '......ssssssS.....',
    '.....SSSssSSS.....',
    '.......hsssS......',
    '.......sssS.......',
    '......SSssS.......',
    '........ssS.......',
    '........sS........',
    '.......sS.........',
    '........sS........',
    '.........S........',
    '........SS........',
    '.......S..........',
    '......S...........'
  ]),
  'elemental-hulk': part('body', [2, 4], [
    '.......hhhhhh.......',
    '......hssssssS......',
    '.hhh.hssssssssS.hhh.',
    'hsssshssssssssSssssS',
    'hssssssssssssssssSSS',
    'sssssssssssssssssSSS',
    'sssS.sssssssssSS.SSS',
    'ssS..sssssssssSS..SS',
    'ssS..sssssssssSS..SS',
    'hhh..sssssssssSS..hh',
    'hhh..sssssssssSS..hh',
    '.....ssssssssSSS....',
    '.....sssSSsssSSS....',
    '....ssssS..sssSSS...',
    '....sssS....ssSSS...',
    '...ssssS....sssSSS..',
    '...SSSS......SSSS...',
    '...SS.S......S.SS...',
    '....................'
  ]),
  'elemental-face-eyes': part('face', [9, 7], [
    'g....g',
    'ge..eg'
  ]),
  'elemental-face-maw': part('face', [9, 7], [
    'g....g',
    'ge..eg',
    '......',
    '.pppp.',
    '..pp..'
  ]),
  'elemental-face-brow': part('face', [9, 6], [
    'pp..pp',
    '.ge.eg',
    '......',
    '..pp..'
  ]),
  'elemental-face-cyclops': part('face', [10, 6], [
    '.gg.',
    'gepg',
    '.gg.',
    '....',
    'pppp'
  ]),
  'elemental-sparks': piece('front', [3, 1], [
    '.f..........F...',
    '......f.........',
    'F.............f.',
    '................',
    '..f.........F...'
  ]),
  'elemental-stones': piece('front', [1, 9], [
    'SS..................',
    'Sh................hS',
    '..................SS',
    '....................',
    '.hS.................',
    '.SS.................'
  ], true),
  'elemental-drops': piece('front', [2, 5], [
    'h...................',
    's.................h.',
    '..................s.',
    '....................',
    '..h.................',
    '..s.................'
  ]),
  'elemental-gusts': piece('front', [0, 8], [
    'hhh..................hh',
    '....................hh.',
    '.hh....................',
    'hh.................hhh.'
  ]),
  'elemental-core': marking(['s'], 'g', 'spots'),
  'elemental-crackle': marking(['S'], 'e', 'bands')
}
