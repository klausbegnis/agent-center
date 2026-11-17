// The wording of the strip above the game's tabs: the room switcher and what it applies to. Kept
// apart from labels.js, which is past the size a module should have.

const plural = (count, one, many) => `${count} ${count === 1 ? one : many}`

export const CONTEXT = {
  room: 'Room',
  allRooms: 'All rooms',
  /** Said with the switcher on Camp, Skills, Market and Bestiary, where it only picks the world. */
  worldTabs: 'Party and Chest show this room; Camp, Skills, Market and Bestiary show its world.',
  /** Said with the switcher on Rooms. */
  roomsTab: 'Shows one room only, or all of them.',
  /** Said with the switcher on every tab: how to move along it from the keyboard. */
  keys: 'Left and Right arrows pick the next room; [ and ] do it from anywhere in the game.',
  scrollBack: 'Show the rooms before',
  scrollOn: 'Show the rooms after',
  jump: 'Jump to a room',
  jumpShort: 'More…',
  world: 'World',
  /**
   * A chip's accessible name and tooltip: the room, then what its signs say in words, so nothing
   * is told by colour or shape alone.
   *
   * @param {{ fullName: string, characters: number | null, isFighting: boolean, canUpgrade: boolean,
   *   isInside?: boolean }} chip
   */
  chip({ fullName, characters, isFighting, canUpgrade, isInside }) {
    if (characters === null) return fullName
    const facts = [plural(characters, 'character', 'characters')]
    if (isFighting) facts.push('fighting')
    if (canUpgrade) facts.push('an upgrade ready')
    if (isInside) facts.push('inside an instance')
    return `${fullName}: ${facts.join(', ')}`
  }
}
