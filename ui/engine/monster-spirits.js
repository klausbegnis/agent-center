// Slimes and ghosts, facing the party. Each is a silhouette and a face laid on it; every face
// fits every silhouette of its race: a slime's face sits around rows 15 to 18, a ghost's around
// rows 8 to 13 (a wraith's in its hood).
// Drawn on the whole 24-pixel grid (`at` is the top left corner). Original drawings.

const part = (slot, at, rows) => ({ slot, rows, at })
const marking = (from, to, pattern) => ({ slot: 'extras', paint: { from, to, pattern, region: 'all' } })
const piece = (layer, at, rows, outline = false) => ({ slot: 'extras', layer, outline, rows, at })

export const SPIRIT_PARTS = {
  'slime-dome': part('body', [4, 11], [
    '......hhhh......',
    '....hhhssssss...',
    '...hhssssssssss.',
    '..hssssssssssss.',
    '.hsssssssssssssS',
    '.sssssssssssssSS',
    'ssssssssssssssSS',
    'sssssssssssssSSS',
    'SsssssssssssSSSS',
    'SSSssssssssSSSSS',
    '.SSSSSSSSSSSSSS.',
    '..SSSSSSSSSSSS..'
  ]),
  'slime-drippy': part('body', [4, 9], [
    '.......hh.......',
    '......hssS......',
    '.....hsssS......',
    '...hhssssssS....',
    '..hssssssssssS..',
    '.hsssssssssssSS.',
    '.sssssssssssssS.',
    'sssssssssssssSSS',
    'ssssssssssssSSSS',
    'SssssssssssSSSSS',
    'SSsSSsssSSSSsSSS',
    '.S.SS.SSSS.S.SS.',
    '.S..S..SS..S..S.',
    '....S.......S...'
  ]),
  'slime-stack': part('body', [5, 5], [
    '.....hhhh.....',
    '....hsssss....',
    '...hsssssss...',
    '...ssssssSS...',
    '....SSSSSS....',
    '...hhssssss...',
    '..hssssssssS..',
    '.hssssssssssS.',
    '.ssssssssssSS.',
    'sssssssssssSSS',
    'sssssssssssSSS',
    'SssssssssssSSS',
    'SSssssssssSSSS',
    'SSSSssssSSSSSS',
    '.SSSSSSSSSSSS.',
    '..SSSSSSSSSS..',
    '...SSSSSSSS...',
    '....SSSSSS....'
  ]),
  'slime-face-dots': part('face', [8, 15], [
    'pp....pp',
    'pg....pg',
    '........',
    '...pp...'
  ]),
  'slime-face-grin': part('face', [8, 15], [
    'pg....pg',
    'pp....pp',
    '.p....p.',
    '..pppp..'
  ]),
  'slime-face-scowl': part('face', [8, 14], [
    'p......p',
    '.pp..pp.',
    '.ep..ep.',
    '........',
    '..pbbp..'
  ]),
  'slime-bubbles': marking(['s'], 'h', 'spots'),
  'slime-bones': piece('front', [12, 18], ['b..b', '.bb.', 'b..b']),
  'slime-core': piece('front', [10, 19], ['.g.', 'geg', '.g.']),
  'slime-drops': piece('front', [2, 13], [
    'h..................',
    's.................h',
    '..................s'
  ]),

  'ghost-sheet': part('body', [5, 3], [
    '.....hhhh.....',
    '....hssssS....',
    '...hssssssS...',
    '..hssssssssS..',
    '..sssssssssS..',
    '.hsssssssssSS.',
    '.ssssssssssSS.',
    'sssssssssssSSS',
    'Ssssssssssss.S',
    'SssssssssssS..',
    '.ssssssssssS..',
    '.ssssssssssS..',
    '.sssssssssSS..',
    '.ssssssssSSS..',
    '.sSsssssSSSS..',
    '..SSsSSsSSS...',
    '..S.SS.SS.S...',
    '.....S..S.....'
  ]),
  'ghost-wisp': part('body', [5, 3], [
    '.....hhhh.....',
    '....hssssS....',
    '...hssssssS...',
    '..hssssssssS..',
    '..sssssssssS..',
    '.hsssssssssS..',
    'hssssssssssSS.',
    'ssssssssssssSS',
    'S.ssssssssss.S',
    '..sssssssssS..',
    '..ssssssssSS..',
    '...sssssssS...',
    '....ssssSS....',
    '.....sssS.....',
    '......ssS.....',
    '.......sS.....',
    '........sS....',
    '.........S....'
  ]),
  'ghost-wraith': part('body', [5, 3], [
    '......cc......',
    '.....cCCc.....',
    '....cCppCc....',
    '...cCppppCc...',
    '...cCppppCc...',
    '..ccCppppCcc..',
    '..cccCppCccc..',
    '.cccccccccccc.',
    'cCcccccccccCcc',
    'cC.cccccccc.Cc',
    'C..cccccccc..C',
    '...ccccccccC..',
    '...cccccccCC..',
    '...ccccccCCC..',
    '..cCcccccCCCc.',
    '..CcCcCcCcCcC.',
    '..C.C.C.C.C...',
    '.....C...C....'
  ]),
  'ghost-face-hollow': part('face', [8, 9], [
    '.pp..pp.',
    '.pp..pp.',
    '........',
    '...pp...',
    '...pp...'
  ]),
  'ghost-face-glare': part('face', [8, 9], [
    'p......p',
    '.ep..pe.',
    '.pp..pp.',
    '........',
    '..pppp..'
  ]),
  'ghost-face-wail': part('face', [8, 8], [
    '........',
    '.gg..gg.',
    '.ge..ge.',
    '........',
    '...pp...',
    '..pppp..',
    '...pp...'
  ]),
  'ghost-face-hooded': part('face', [10, 7], [
    'g..g',
    'e..e'
  ]),
  'ghost-chains': piece('front', [6, 14], ['mM..........', '..mM......Mm', '....mM..mM..', '......Mm....']),
  'ghost-lantern': piece('front', [1, 11], ['.m..', 'mfm.', 'fFf.', 'mfm.', '.m..'], true),
  'ghost-motes': piece('front', [2, 3], [
    'g...................',
    '.................g..',
    '....................',
    '....................',
    '..................g.',
    'g...................'
  ]),
  'ghost-tatters': marking(['s', 'c'], 'S', 'bands')
}
