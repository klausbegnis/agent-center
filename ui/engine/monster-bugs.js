// Giant spiders and giant insects, seen from the side and facing left. Their parts are drawn on
// the whole 24-pixel grid (`at` is the top left corner), and every part of a slot meets the
// parts of the next slot at the same joints: a spider's waist, an insect's neck and waist. A
// mantis has joints of its own; its role keeps its parts together. Original drawings.

const part = (slot, at, rows, layer) => ({ slot, rows, at, ...(layer ? { layer } : {}) })
const marking = (from, to, pattern) => ({ slot: 'extras', paint: { from, to, pattern, region: 'all' } })
const piece = (layer, at, rows) => ({ slot: 'extras', layer, outline: false, rows, at })

export const BUG_PARTS = {
  // Spider: its legs reach out from the waist at (12-13, 16-18), the head sits left of it.
  'spider-legs-long': part('legs', [0, 12], [
    '.....s..............s...',
    '....sSs....s..s....sSs..',
    '...sS.sS..sSssSs..sS.sS.',
    '..sS...sSsS....SsSs...sS',
    '..s.....sS......Ss.....s',
    '.sS....sS........Ss....s',
    '.s....sS..........Ss...s',
    '.s...sS............Ss..s',
    '....sS..............Ss..',
    '...sS................Ss.',
    '...p..................p.'
  ]),
  'spider-legs-hairy': part('legs', [0, 13], [
    '....rr..............rr..',
    '...rRRr....r..r....rRRr.',
    '..rR..Rr..rRrrRr..rR..Rr',
    '.rR....RrrR....RrrR....R',
    '.r......rR......Rr.....r',
    '.r.....rR........Rr....r',
    '.r....rR..........Rr...r',
    '.....rR............Rr...',
    '....rR..............Rr..',
    '...p..................p.'
  ]),
  'spider-abdomen-round': part('abdomen', [11, 11], [
    '....hhhh...',
    '..hhssssss.',
    '.hsssssssss',
    'hssssassssS',
    'sssaaaassSS',
    'ssssassssSS',
    'SsssssssSSS',
    '.SSSSSSSSS.',
    '...SSSSS...'
  ]),
  'spider-abdomen-striped': part('abdomen', [11, 11], [
    '....hhhh...',
    '..hhaassss.',
    '.hsssaassss',
    'haassssaasS',
    'sssaassssaS',
    'saassssaaSS',
    'SsssaaSSSSS',
    '.SSSSaaSSS.',
    '...SSSSS...'
  ]),
  'spider-abdomen-spiked': part('abdomen', [11, 9], [
    '...b...b...',
    '...bb.bb...',
    '....hhhh...',
    '..hhssssssb',
    '.hssssssssb',
    'hsssssssssS',
    'ssssssssSSS',
    'SsssssssSSS',
    '.SSSSSSSSS.',
    '...SSSSS...'
  ]),
  'spider-head-eyed': part('head', [5, 14], [
    '..shhs...',
    '.seegsss.',
    'segeesssS',
    'sssssssSS',
    '.SpSSSSS.',
    '.b.b.....'
  ]),
  'spider-head-fanged': part('head', [5, 14], [
    '..shhs...',
    '.shssss..',
    'seesesssS',
    'sssssssSS',
    '.SSSSSSS.',
    'bB.bB....',
    'b..b.....'
  ]),
  'spider-head-crowned': part('head', [5, 12], [
    '...b.b...',
    '..bsbs...',
    '..shhs...',
    '.seeeess.',
    'segeesssS',
    'sssssssSS',
    '.SpSSSSS.',
    '.b.b.....'
  ]),
  'spider-mark-skull': piece('front', [15, 13], ['.bb.', 'bppb', '.bb.']),
  'spider-web': piece('back', [14, 2], [
    'B...B...B',
    '.B..B..B.',
    '..B.B.B..',
    'BBBBbBBBB',
    '..B.B.B..',
    '.B..B..B.'
  ]),
  'spider-bristles': marking(['s', 'h'], 'r', 'spots'),
  'spider-glow-eyes': marking(['e'], 'g', 'all'),

  // Insect: neck at (7-8, 13-15), waist at (13-14, 14-16).
  'insect-head-beetle': part('head', [2, 10], [
    '..b....',
    '..bB...',
    '...bss.',
    '.sshsss',
    'seesSss',
    'sssssSs',
    'bpSSSS.',
    '.b.....'
  ]),
  'insect-head-wasp': part('head', [2, 9], [
    '...r...',
    '....r..',
    '..shss.',
    '.seeess',
    'seeessS',
    '.sssSSs',
    '.bpSS..',
    '..b....'
  ]),
  'insect-head-mantis': part('head', [5, 4], [
    'r.....r',
    '.r...r.',
    'eesssee',
    'gesssge',
    '.ssSss.',
    '..sSs..',
    '...p...'
  ]),
  'insect-thorax-plated': part('thorax', [6, 12], [
    '..hhh...',
    '.hssss..',
    'hsssssS.',
    'ssssssSS',
    'SsssSSSS',
    '.SSSSSS.',
    '.p.p..p.',
    'p..p...p',
    'p...p...',
    '.....p..',
    '.....p..'
  ]),
  'insect-thorax-slender': part('thorax', [6, 12], [
    '..hh....',
    '.hsss...',
    'sssssS..',
    'SsssSSs.',
    '.SSSSSs.',
    '..p..p..',
    '.p...p..',
    '.p....p.',
    'p.....p.',
    'p......p',
    '.......p'
  ]),
  'insect-thorax-raptor': part('thorax', [3, 11], [
    '.....ss......',
    '....sSss.....',
    '..hsssSss....',
    '.sSb.sssss...',
    'sS.b..sssss..',
    'b..b...SsssS.',
    'b.......SSsSs',
    '........p..p.',
    '.......p...p.',
    '......p.....p',
    '......p.....p',
    '.....p......p'
  ]),
  'insect-abdomen-shell': part('abdomen', [12, 10], [
    '...hhhh....',
    '.hhaaaaas..',
    'haaaaaaaaS.',
    'aaaaaAaaaSS',
    'aaaaaAaaaSS',
    'saaaaAaaSSS',
    'SsaaaAaSSS.',
    '.SSSSSSSS..',
    '..p..p.p...'
  ]),
  'insect-abdomen-stinger': part('abdomen', [12, 11], [
    '..hhh......',
    '.saassss...',
    'ssaasssaas.',
    'ssaassaasSS',
    'SSaaSSaaSSS',
    '.SaaSSaaSS.',
    '..SSSSSSSb.',
    '.........bb'
  ]),
  'insect-abdomen-long': part('abdomen', [12, 12], [
    '.hhh.......',
    'sssssss....',
    'sssssssss..',
    'SsssssssssS',
    '.SSSSSSSSSS',
    '..SSSSSSSS.'
  ]),
  'insect-wings-clear': part('wings', [9, 5], [
    '....ccc...',
    '..ccCCcc..',
    '.cCcccCcc.',
    'cCccccccC.',
    'cccccccC..',
    '.cccccC...',
    '..ccCC....'
  ]),
  'insect-wings-twin': part('wings', [9, 4], [
    '.....ccc..',
    '...ccCCcc.',
    '.ccCcccc..',
    'cCcccc....',
    '.cc.cccc..',
    '...cCcccc.',
    '....cccc..'
  ]),
  'insect-wings-shell-open': part('wings', [10, 5], [
    '.......aa',
    '.....aaA.',
    '...aaaA..',
    '.aaaAA...',
    'aaAA..c..',
    'A....cc..',
    '....cc...'
  ]),
  'insect-spots': marking(['a'], 'p', 'spots'),
  'insect-sheen': marking(['s', 'a'], 'h', 'top'),
  'insect-bands': marking(['s'], 'a', 'stripes'),
  'insect-glow': marking(['e'], 'g', 'all')
}
