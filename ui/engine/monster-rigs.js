// The skeletons generated monsters are built on: where each slot of a rig sits on the drawing
// grid, the order slots are laid down in, and which slots outline themselves over what lies
// under them. Humanoids share three builds with fixed joint rows, so any head, torso and legs of
// one build line up. Never touches the DOM.

/** Every generated monster is drawn on a square grid of this many pixels. */
export const MONSTER_GRID = 24
/**
 * The part of the grid shown as the monster's square: one pixel of margin for the outline round
 * shapes that use rows 3 to 22 and columns 2 to 21. Crowns, horns and weapons may reach past it.
 */
export const MONSTER_VIEW_BOX = '1 2 22 22'

/** Head drawings are this size on every humanoid build, so headgear fits every head. */
export const HEAD_SIZE = { width: 10, height: 8 }

/**
 * A humanoid build. `anchors` are the top left corners of the head, torso and legs drawings;
 * `hands` the pixels a held item's grip is put on (main hand on the left, off hand on the right).
 * Torso and legs drawings of a build are exactly `torso` and `legs` in size.
 */
const humanoid = ({ head, torso, legs, torsoSize, legsSize, hands }) => ({
  kind: 'humanoid',
  anchors: { head, torso, legs, headgear: head },
  sizes: { head: HEAD_SIZE, torso: torsoSize, legs: legsSize },
  hands,
  /** Laid down in this order; `back` extras go first, `front` extras last. */
  order: ['back', 'legs', 'torso', 'head', 'face', 'headgear', 'held', 'front'],
  /** These outline themselves where they cover another part, so they read on top of it. */
  outlined: ['headgear', 'held', 'front']
})

/** A rig whose parts are drawn on the whole grid, in the order of its slots. */
const whole = (order, outlined) => ({
  kind: 'whole',
  anchors: {},
  order: ['back', ...order, 'front'],
  outlined: [...outlined, 'front']
})

export const RIGS = {
  'humanoid-small': humanoid({
    head: [7, 8],
    torso: [7, 16],
    legs: [8, 20],
    torsoSize: { width: 10, height: 4 },
    legsSize: { width: 8, height: 3 },
    hands: { main: [8, 19], off: [15, 19] }
  }),
  'humanoid-medium': humanoid({
    head: [7, 4],
    torso: [6, 12],
    legs: [7, 18],
    torsoSize: { width: 12, height: 6 },
    legsSize: { width: 10, height: 5 },
    hands: { main: [7, 17], off: [16, 17] }
  }),
  'humanoid-large': humanoid({
    head: [7, 3],
    torso: [4, 11],
    legs: [5, 18],
    torsoSize: { width: 16, height: 7 },
    legsSize: { width: 14, height: 5 },
    hands: { main: [5, 17], off: [18, 17] }
  }),
  dragon: whole(['wings', 'tail', 'body', 'head'], ['head', 'wings']),
  spider: whole(['legs', 'abdomen', 'head'], ['head']),
  insect: whole(['wings', 'abdomen', 'thorax', 'head'], ['head', 'thorax']),
  golem: whole(['legs', 'torso', 'arms', 'head'], ['arms', 'head']),
  treant: whole(['roots', 'trunk', 'crown', 'face'], ['crown']),
  slime: whole(['body', 'face'], []),
  ghost: whole(['body', 'face'], []),
  elemental: whole(['body', 'face'], [])
}

/** The rig a look is built on, or null for one this UI does not know. */
export const rigOf = (rigId) => (Object.hasOwn(RIGS, rigId) ? RIGS[rigId] : null)
