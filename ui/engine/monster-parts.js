// Every part a generated monster can be built from, by id. The races in game/races.json name
// these ids; a saved monster keeps the ids it was given, so parts are added, never renamed.
import { BODY_PARTS } from './monster-bodies.js'
import { BOSS_PARTS } from './monster-boss-parts.js'
import { BUG_PARTS } from './monster-bugs.js'
import { CONSTRUCT_PARTS } from './monster-constructs.js'
import { DRAGON_PARTS } from './monster-dragons.js'
import { ELEMENTAL_PARTS } from './monster-elementals.js'
import { EXTRA_PARTS } from './monster-extras.js'
import { HEAD_PARTS } from './monster-heads.js'
import { MONSTROUS_HEAD_PARTS } from './monster-heads-undead.js'
import { HELD_PARTS } from './monster-held.js'
import { SPIRIT_PARTS } from './monster-spirits.js'
import { HEADGEAR_PARTS, OUTFIT_PARTS } from './monster-wardrobe.js'

/** Every module's parts. Ids are unique across all of them; a test checks it. */
const PART_SETS = [BODY_PARTS, HEAD_PARTS, MONSTROUS_HEAD_PARTS, OUTFIT_PARTS, HEADGEAR_PARTS, HELD_PARTS,
  EXTRA_PARTS, DRAGON_PARTS, BUG_PARTS, SPIRIT_PARTS, ELEMENTAL_PARTS, CONSTRUCT_PARTS, BOSS_PARTS]

export const PART_ID_COUNT = PART_SETS.reduce((sum, set) => sum + Object.keys(set).length, 0)

export const MONSTER_PARTS = {
  ...BODY_PARTS,
  ...HEAD_PARTS,
  ...MONSTROUS_HEAD_PARTS,
  ...OUTFIT_PARTS,
  ...HEADGEAR_PARTS,
  ...HELD_PARTS,
  ...EXTRA_PARTS,
  ...DRAGON_PARTS,
  ...BUG_PARTS,
  ...SPIRIT_PARTS,
  ...ELEMENTAL_PARTS,
  ...CONSTRUCT_PARTS,
  ...BOSS_PARTS
}

/** The part with this id, or null: `none` and ids this UI does not know draw nothing. */
export const partById = (id) =>
  (typeof id === 'string' && Object.hasOwn(MONSTER_PARTS, id) ? MONSTER_PARTS[id] : null)
