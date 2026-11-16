// Names for retired characters. The game keeps only a number for each (`nameId`); the same
// number always gives the same name, made of two short words. Never touches the DOM.

const FIRST_WORDS = [
  'Amber', 'Ash', 'Birch', 'Bramble', 'Cinder', 'Clover', 'Copper', 'Dusk',
  'Ember', 'Fern', 'Flint', 'Frost', 'Hazel', 'Ivy', 'Juniper', 'Lark',
  'Maple', 'Marsh', 'Moss', 'Nettle', 'Oak', 'Pebble', 'Quill', 'Reed',
  'Rowan', 'Rust', 'Sage', 'Slate', 'Sorrel', 'Thistle', 'Willow', 'Wren'
]
const SECOND_WORDS = [
  'Bell', 'Brook', 'Button', 'Candle', 'Cap', 'Coat', 'Drum', 'Feather',
  'Glove', 'Harp', 'Hat', 'Hook', 'Kettle', 'Knot', 'Lamp', 'Lantern',
  'Leaf', 'Loom', 'Mitten', 'Needle', 'Pipe', 'Pocket', 'Ribbon', 'Ring',
  'Scarf', 'Spark', 'Spoon', 'Stone', 'Thimble', 'Torch', 'Whistle', 'Wick'
]

/**
 * The name of a retired character: "Moss Lantern".
 *
 * @param {number} nameId a whole number from the view state, possibly large
 */
export function retireeName(nameId) {
  const number = Math.abs(Math.floor(Number(nameId))) || 0
  const first = FIRST_WORDS[number % FIRST_WORDS.length]
  const second = SECOND_WORDS[Math.floor(number / FIRST_WORDS.length) % SECOND_WORDS.length]
  return `${first} ${second}`
}
