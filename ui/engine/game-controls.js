// Small pieces the game's panels are built from: cards, meters, switches and confirmations.
// They draw what they are given and work nothing out.
import { button, el } from './dom.js'

/**
 * A card with a heading and paragraphs.
 *
 * @param {string} title
 * @param {string[]} lines
 */
export function card(title, lines = []) {
  const node = el('section', 'ac-game-card')
  node.append(el('h2', 'ac-game-card-title', title), ...lines.map((line) => el('p', 'ac-game-card-line', line)))
  return node
}
