// Extras of the humanoid races: markings painted over what is drawn (`paint`), and pieces laid
// behind the body (`layer: 'back'`: wings, tails, capes) or in front of it, each drawn for every
// build it fits at the build's own place on the grid. Original drawings.

/** The same rows flipped left to right, for the far wing of a pair. */
export const mirrored = (rows) => rows.map((row) => [...row].reverse().join(''))

const marking = (paint) => ({ slot: 'extras', paint })
const pieces = (layer, byRig, outline = true) => ({ slot: 'extras', layer, outline, rigs: byRig })

const WING = [
  's......',
  'sA.....',
  'sAs....',
  'sAAs...',
  'sAAAs..',
  '.sAAAs.',
  '.sAAAAs',
  '..sAAAs',
  '..s.sAs',
  '.....ss'
]
const wings = (left, right) => ({
  pieces: [{ rows: WING, at: left }, { rows: mirrored(WING), at: right }]
})

const DEMON_TAIL = [
  '.....a..',
  '....aAa.',
  '.....s..',
  '......s.',
  '......s.',
  's....s..',
  '.ssss...'
]
const LIZARD_TAIL = [
  '........s',
  '.......sS',
  '.sss..sS.',
  'sSSSssS..',
  '.SSSSS...'
]
/** A cape hanging behind the body: cloth in shade, lit at its edges, ragged at the hem. */
const cape = (width, height) => Array.from({ length: height }, (_, row) => {
  if (row === 0) return `.${'c'.repeat(width - 2)}.`
  if (row === height - 1) return 'C.'.repeat(width / 2)
  return `c${'C'.repeat(width - 2)}c`
})
/** Bat wings: the demon's wing in the colours of cloth, for vampires. */
const batWing = (rows) => rows.map((row) => row.replaceAll('s', 'c').replaceAll('A', 'C'))
const batWings = (left, right) => ({
  pieces: [{ rows: batWing(WING), at: left }, { rows: batWing(mirrored(WING)), at: right }]
})
const NECKLACE = ['b....b', '.b..b.', '..bb..']
const CHAIN = ['mM......', '..mM....', '....mM..', '......mM']

export const EXTRA_PARTS = {
  warpaint: marking({ from: ['s', 'h'], to: 'a', pattern: 'stripes', region: 'head' }),
  blotches: marking({ from: ['s', 'h'], to: 'S', pattern: 'spots', region: 'all' }),
  'glowing-eyes': marking({ from: ['e', 'p'], to: 'g', pattern: 'all', region: 'head' }),
  moss: marking({ from: ['s', 'h', 'r', 'c', 'w'], to: 'v', pattern: 'top', region: 'all' }),
  'demon-wings': pieces('back', {
    'humanoid-small': wings([1, 9], [16, 9]),
    'humanoid-medium': wings([0, 5], [17, 5]),
    'humanoid-large': wings([0, 3], [17, 3])
  }),
  'demon-tail': pieces('back', {
    'humanoid-small': { rows: DEMON_TAIL, at: [13, 16] },
    'humanoid-medium': { rows: DEMON_TAIL, at: [14, 15] },
    'humanoid-large': { rows: DEMON_TAIL, at: [15, 15] }
  }),
  'lizard-tail': pieces('back', {
    'humanoid-medium': { rows: LIZARD_TAIL, at: [13, 18] },
    'humanoid-large': { rows: LIZARD_TAIL, at: [14, 18] }
  }),
  'bat-wings': pieces('back', {
    'humanoid-small': batWings([1, 9], [16, 9]),
    'humanoid-medium': batWings([0, 5], [17, 5]),
    'humanoid-large': batWings([0, 3], [17, 3])
  }),
  cape: pieces('back', {
    'humanoid-small': { rows: cape(10, 6), at: [7, 16] },
    'humanoid-medium': { rows: cape(12, 9), at: [6, 12] },
    'humanoid-large': { rows: cape(16, 10), at: [4, 11] }
  }),
  'bone-necklace': pieces('front', {
    'humanoid-small': { rows: NECKLACE, at: [9, 16] },
    'humanoid-medium': { rows: NECKLACE, at: [9, 12] },
    'humanoid-large': { rows: NECKLACE, at: [9, 11] }
  }, false),
  chains: pieces('front', {
    'humanoid-medium': { rows: CHAIN, at: [8, 13] },
    'humanoid-large': { rows: CHAIN, at: [8, 12] }
  }, false)
}
