// The "Save file" card of the game settings: export the game as a download and as text to copy
// (the panel runs in Orca's webview, where a download may be blocked), and import a chosen or
// pasted file in place of the whole game after a confirmation. The card is built once and kept
// across the settings' redraws, so a pasted text or an open question survives a state update.
import { button, el } from './dom.js'
import { confirmButton, section } from './game-controls.js'
import { SAVE_FILE } from './labels.js'
import { readSaveText, saveFileName, saveFileText } from './save-file.js'

/** How long the Blob URL of a download is kept before it is let go. */
const DOWNLOAD_URL_MS = 60_000

/**
 * A labelled text box.
 *
 * @param {string} label
 * @param {string} key the `data-key` that keeps the focus across redraws
 */
function textBox(label, key) {
  const field = el('label', 'ac-game-field ac-game-save-field')
  const box = el('textarea', 'ac-game-input ac-game-save-text')
  box.rows = 4
  box.spellcheck = false
  box.dataset.key = key
  field.append(el('span', 'ac-game-field-label', label), box)
  return { field, box }
}

/**
 * @param {{ actions: Record<string, (...args: unknown[]) => Promise<unknown>> }} options
 * @returns {{ element: HTMLElement, showMessage: (action: string, message: string) => void }}
 *   `showMessage` shows why an export or an import did not go through, in the card
 */
export function createSaveFileCard({ actions }) {
  const children = [el('p', 'ac-game-card-line', SAVE_FILE.note)]
  const parts = {}
  if (actions.exportSave) parts.exportSave = exportPart(actions.exportSave)
  if (actions.importSave) parts.importSave = importPart(actions.importSave)
  children.push(...Object.values(parts).map((part) => part.element))
  return {
    element: section(SAVE_FILE.title, children, 'ac-game-save-file'),
    showMessage(action, message) {
      parts[action]?.showMessage(message)
    }
  }
}

function exportPart(exportSave) {
  const part = el('div', 'ac-game-save-part')
  const status = el('p', 'ac-game-card-line ac-game-save-status')
  status.setAttribute('role', 'status')
  const { field, box } = textBox(SAVE_FILE.exportText, 'save-export-text')
  box.readOnly = true
  const copyStatus = el('span', 'ac-game-save-status')
  copyStatus.setAttribute('role', 'status')
  const copy = button(SAVE_FILE.copy, 'ac-button', { onClick: () => copyText(box, copyStatus) })
  copy.dataset.key = 'save-copy'
  const copyRow = el('div', 'ac-game-row')
  copyRow.append(copy, copyStatus)
  const shown = el('div', 'ac-game-save-shown')
  shown.hidden = true
  shown.append(field, copyRow)
  const failure = el('p', 'ac-game-missing ac-game-save-error')
  failure.setAttribute('role', 'alert')

  const start = button(SAVE_FILE.export, 'ac-button ac-primary', {
    onClick: async () => {
      start.disabled = true
      failure.textContent = ''
      status.textContent = SAVE_FILE.exporting
      const file = await exportSave()
      start.disabled = false
      status.textContent = ''
      if (!file) return
      const text = saveFileText(file)
      box.value = text
      copyStatus.textContent = ''
      shown.hidden = false
      download(text, saveFileName(new Date()))
      status.textContent = SAVE_FILE.exported
    }
  })
  start.dataset.key = 'save-export'
  part.append(start, status, failure, shown)
  return {
    element: part,
    showMessage(message) {
      failure.textContent = message
    }
  }
}

/** Offers the text as a file. A webview that blocks downloads simply ignores it. */
function download(text, name) {
  try {
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }))
    const link = el('a')
    link.href = url
    link.download = name
    link.hidden = true
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), DOWNLOAD_URL_MS)
  } catch (error) {
    console.error('game: the save file could not be offered as a download', error)
  }
}

/** Copies the text, or selects it for the person to copy where the clipboard is not offered. */
async function copyText(box, status) {
  try {
    await navigator.clipboard.writeText(box.value)
    status.textContent = SAVE_FILE.copied
  } catch {
    box.focus()
    box.select()
    status.textContent = SAVE_FILE.copySelected
  }
}

function importPart(importSave) {
  const part = el('div', 'ac-game-save-part')
  const fileField = el('label', 'ac-game-field ac-game-save-field')
  const picker = el('input', 'ac-game-save-picker')
  picker.type = 'file'
  picker.accept = 'application/json,.json'
  picker.dataset.key = 'save-file'
  fileField.append(el('span', 'ac-game-field-label', SAVE_FILE.importFile), picker)
  const { field, box } = textBox(SAVE_FILE.importText, 'save-import-text')
  const message = el('p', 'ac-game-missing ac-game-save-error')
  message.setAttribute('role', 'alert')
  const done = el('p', 'ac-game-card-line ac-game-save-status')
  done.setAttribute('role', 'status')

  const confirm = confirmButton({
    label: SAVE_FILE.import,
    question: SAVE_FILE.importQuestion,
    confirm: SAVE_FILE.importConfirm,
    key: 'save-import',
    onConfirm: async () => {
      const read = readSaveText(box.value)
      if (read.error) {
        message.textContent = SAVE_FILE.textError[read.error]
        return
      }
      message.textContent = ''
      if (await importSave(read.file)) {
        box.value = ''
        picker.value = ''
        check()
        done.textContent = SAVE_FILE.imported
      }
    }
  })
  const opener = confirm.querySelector('[data-key="save-import"]')

  /** Says at once when the text cannot be a save file, without asking the worker. */
  function check() {
    const read = readSaveText(box.value)
    const isEmpty = read.error === 'empty'
    message.textContent = read.error && !isEmpty ? SAVE_FILE.textError[read.error] : ''
    opener.disabled = Boolean(read.error)
    done.textContent = ''
  }

  box.addEventListener('input', check)
  picker.addEventListener('change', async () => {
    const chosen = picker.files?.[0]
    if (!chosen) return
    try {
      box.value = await chosen.text()
    } catch (error) {
      console.error('game: the chosen save file could not be read', error)
      box.value = ''
      message.textContent = SAVE_FILE.readFailed
      return
    }
    check()
  })
  check()
  part.append(fileField, field, message, confirm, done)
  return {
    element: part,
    showMessage(text) {
      message.textContent = text
    }
  }
}
