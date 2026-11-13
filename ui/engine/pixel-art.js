// The game's monster bodies and the settings cog, in pixels. Each is a grid of characters, one per
// pixel, turned into SVG path data here so the drawing modules only lay paths down. The icons of
// skills, materials and classes are in game-icons.js. Original drawings, neutral to every theme.

/**
 * Monster bodies on a 12 × 12 grid. Inks: `o` outline, `b` body (the monster's accent colour),
 * `h` highlight, `s` shade, `e` eye, `p` pupil, `.` nothing.
 */
export const MONSTER_SHAPES = {
  blob: [
    '............',
    '............',
    '....oooo....',
    '..oohhbboo..',
    '.ohhbbbbbbo.',
    '.obeebbeebo.',
    'obbepbbepbbo',
    'obbbbbbbbbbo',
    'obbbbssbbbbo',
    'obbbbbbbbbso',
    'osbbbbbbbsso',
    '.oooooooooo.'
  ],
  tall: [
    '...oooooo...',
    '..obhbbbbo..',
    '..obepbepo..',
    '..obbssbbo..',
    '...oobboo...',
    '.oobbbbbboo.',
    'obhobbbbobbo',
    'obbobbbbobbo',
    'ooo.obbo.ooo',
    '...obbbbo...',
    '..obo..obo..',
    '..ooo..ooo..'
  ],
  wide: [
    '............',
    '..oo....oo..',
    '.oepo..oepo.',
    '..oo....oo..',
    '.oooooooooo.',
    'obhhbbbbbbbo',
    'obhbbbbbbbbo',
    'obbbbbbbbbbo',
    'osbbsbbsbbso',
    '.oooooooooo.',
    '.o.o.oo.o.o.',
    '............'
  ],
  floating: [
    '....oooo....',
    '..oohhbboo..',
    '.ohbbbbbbbo.',
    '.obeebbeebo.',
    'obbepbbepbbo',
    'obbbbbbbbbbo',
    'obbbboobbbbo',
    'obbbbbbbbbbo',
    'obbbbbbbbbso',
    'obsbbsbbsbso',
    'oo.oo.oo.oo.',
    '............'
  ],
  swarm: [
    '............',
    '....ooo.....',
    '...obeo.....',
    '...obbo..ooo',
    '....oo..obeo',
    '.ooo....obbo',
    '.obeo....oo.',
    '.obbo.......',
    '..oo..ooo...',
    '.....obeo...',
    '.....obbo...',
    '......oo....'
  ]
}

/** The inks of a monster, back to front. */
export const MONSTER_INKS = ['o', 'b', 'h', 's', 'e', 'p']

/**
 * SVG path data covering every pixel of one ink, one rectangle per run along a row.
 *
 * @param {string[]} rows
 * @param {string} ink
 */
export function pixelPath(rows, ink) {
  const parts = []
  rows.forEach((row, y) => {
    let x = 0
    while (x < row.length) {
      if (row[x] !== ink) {
        x += 1
        continue
      }
      let end = x
      while (end < row.length && row[end] === ink) end += 1
      parts.push(`M${x} ${y}h${end - x}v1h-${end - x}z`)
      x = end
    }
  })
  return parts.join('')
}

/** The grid size of a drawing, as an SVG viewBox. */
export function viewBoxOf(rows) {
  return `0 0 ${rows[0]?.length ?? 0} ${rows.length}`
}

/** A monster's body; one this UI does not know is drawn as a blob. */
export function monsterShape(body) {
  return MONSTER_SHAPES[body] ?? MONSTER_SHAPES.blob
}

/** The mark on the game settings button: a cog. */
export const SETTINGS_MARK = [
  '...##...',
  '.#.##.#.',
  '..####..',
  '###..###',
  '###..###',
  '..####..',
  '.#.##.#.',
  '...##...'
]
