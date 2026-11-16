// Dragons, seen from the side and facing left. Their parts are drawn on the whole 24-pixel grid
// (`at` is the top left corner), and every part of a slot meets the parts of the next slot at the
// same joints: the neck, the tail root and the wing root. Original drawings.

const part = (slot, at, rows, layer) => ({ slot, rows, at, ...(layer ? { layer } : {}) })
const marking = (from, to, pattern) => ({ slot: 'extras', paint: { from, to, pattern, region: 'all' } })
const piece = (layer, at, rows) => ({ slot: 'extras', layer, outline: false, rows, at })

export const DRAGON_PARTS = {
  // Dragon: neck joint at (8-9, 12), tail root at (17-18, 16-18), wing root at (12-14, 13).
  'dragon-body-crouched': part('body', [4, 11], [
    '....ss............',
    '...shss...hhh.....',
    '...shsss.hssshh...',
    '..sshssshsssssshs.',
    '..sbbssssssssssss.',
    '.ssbbssssssssssSs.',
    '.sbbbbSsssssSSSS..',
    '.SbbbbSSSSSSSsSS..',
    '..sS.SS...sSSsS...',
    '..sS..S...sS..sS..',
    '.sSS.SS..sSS.sSS..',
    'pp.ppp..pp.ppp.p..'
  ]),
  'dragon-body-rearing': part('body', [4, 11], [
    '....ss............',
    '...shss...........',
    '...shsss..hh......',
    '..sshsssshsshh....',
    '..sbbssssssssshs..',
    '..sbbsssssssssss..',
    '..sbbbsssssssSSs..',
    '..sbbbSssssSSSSs..',
    '.ssSbbSsssSSSsS...',
    '.pp.sSS...sSSSS...',
    '....sS...sSSSss...',
    '...pp.p.pp.ppp.p..'
  ]),
  'dragon-body-stout': part('body', [4, 11], [
    '....ss............',
    '...shss..hhhh.....',
    '..sshsss.hsssshh..',
    '.sssshssshssssssh.',
    '.ssbbsssssssssssss',
    '.sbbbbssssssssssSs',
    '.sbbbbbSssssssSSSs',
    '.SbbbbbSSSSSSSSSS.',
    '..sSSS.SSS..sSSS..',
    '..sSS...SS..sSS...',
    '.sSSS..sSS.sSSS...',
    'pp.pp.pp.ppp.pp...'
  ]),
  'dragon-head-horned': part('head', [1, 4], [
    '........bb',
    '.......bB.',
    '.....shhb.',
    '...sshhsss',
    '.sshhsesss',
    'sssssssSss',
    'pppsSSsSs.',
    '.bpbSSsss.',
    '....sssS..'
  ]),
  'dragon-head-frilled': part('head', [1, 4], [
    '.......a.a',
    '......aAaA',
    '.....shhaA',
    '...sshhssa',
    '.sshhsesss',
    'sssssssSsA',
    'pppsSSsSa.',
    '.bpbSSsss.',
    '....sssS..'
  ]),
  'dragon-head-blunt': part('head', [1, 4], [
    '..........',
    '......bbb.',
    '....shhhb.',
    '..sshhhsss',
    'sshhhsesss',
    'shsssssSss',
    'sppppSsSs.',
    'sbpbbSsss.',
    '.sSSSssS..'
  ]),
  'dragon-wings-bat': part('wings', [11, 3], [
    '.........sS',
    '........sSa',
    '.......sSaa',
    '......sSaaA',
    '.....sSaaAa',
    '....sSaaAa.',
    '...sSaaAaa.',
    '..sSaaAa.a.',
    '.sSaaAa....',
    'sSaa.a.....',
    'Saa........'
  ]),
  'dragon-wings-tattered': part('wings', [11, 3], [
    '.........sS',
    '........sS.',
    '.......sSa.',
    '......sSaaA',
    '.....sSa.Aa',
    '....sSaaA..',
    '...sSa.Aa..',
    '..sSaaA....',
    '.sSa.a.....',
    'sSaa.......',
    'Sa.........'
  ]),
  'dragon-wings-folded': part('wings', [11, 7], [
    '....sSS....',
    '...sSaaS...',
    '..sSaaAaS..',
    '.sSaaAaaAS.',
    'sSaaAaaAa..',
    'SaaAaa.a...',
    'aaa........'
  ]),
  'dragon-tail-spade': part('tail', [17, 14], [
    '.....aa',
    '....aAa',
    '....sA.',
    '...sS..',
    'sssS...',
    'sSS....',
    'SS.....'
  ]),
  'dragon-tail-spiked': part('tail', [17, 14], [
    '......a',
    '....asS',
    '....sS.',
    '..asS..',
    'sssS...',
    'sSS....',
    'SS.....'
  ]),
  'dragon-spines': piece('front', [4, 11], ['.....a.a.a.a......']),
  'dragon-belly-glow': marking(['b'], 'g', 'bands'),
  'dragon-scales': marking(['s'], 'h', 'checker'),
  'dragon-smoke': piece('front', [0, 7], ['.c.', 'c.c', '.c.'])
}
