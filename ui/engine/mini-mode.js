// Mini mode: in a very small window (a narrow panel, or picture-in-picture) only the rooms are
// shown, without the header or the detail card.

const MINI_MAX_WIDTH = 240
const MINI_MAX_HEIGHT = 300

/** Keeps the `ac-mini` class on `root` in step with the size of the window it is in. */
export function watchMiniMode(root) {
  // The window can change: the scene moves to another one when it goes to picture-in-picture.
  let boundWindow = null

  function check() {
    const view = root.ownerDocument.defaultView
    if (!view) return
    if (view !== boundWindow) {
      boundWindow = view
      view.addEventListener('resize', check)
    }
    root.classList.toggle('ac-mini', view.innerWidth < MINI_MAX_WIDTH || view.innerHeight < MINI_MAX_HEIGHT)
  }

  new ResizeObserver(check).observe(root)
  check()
}
