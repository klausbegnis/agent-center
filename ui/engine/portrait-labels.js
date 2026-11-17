// The wording of a character's portrait on the Party tab.

export const PORTRAIT = {
  /** The portrait's accessible name and tooltip when it shows the sprite and leads to the room. */
  show: (name) => `${name}: show in the room`,
  /** Why the portrait is a placeholder. */
  placeholder(name, reason) {
    if (reason === 'hidden') return `${name} is not on screen: its room is hidden.`
    if (reason === 'loading') return `${name}'s room is still loading its theme.`
    return `${name} is not on screen: no agent in a room on screen runs this session.`
  }
}
