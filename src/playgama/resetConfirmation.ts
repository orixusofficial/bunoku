import { pauseForDialog } from './platform.ts'

let open = false

// Browser confirm() is blocked by the host iframe's missing allow-modals.
// Reuse Bunoku's dialog classes, outside the temporarily inert game root.
export function confirmPuzzleReset(message: string, stay: string, restart: string, onConfirm: () => void) {
  if (open) return
  open = true
  const resume = pauseForDialog(), previous = document.activeElement as HTMLElement | null
  const backdrop = document.createElement('div'), panel = document.createElement('section')
  const heading = document.createElement('h2'), cancel = document.createElement('button'), confirm = document.createElement('button')
  backdrop.className = 'dialog-backdrop'; panel.className = 'settings-dialog'
  panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-modal', 'true'); panel.setAttribute('aria-labelledby', 'reset-confirm-title')
  heading.id = 'reset-confirm-title'; heading.textContent = message
  cancel.className = 'pill-button secondary-button'; cancel.textContent = stay
  confirm.className = 'pill-button primary-button'; confirm.textContent = restart
  let closed = false
  const close = (accepted: boolean) => {
    if (closed) return
    closed = true
    backdrop.remove(); open = false; resume(); previous?.focus({ preventScroll: true })
    if (accepted) onConfirm()
  }
  cancel.onclick = () => close(false); confirm.onclick = () => close(true)
  panel.onkeydown = event => {
    if (event.key === 'Tab') { event.preventDefault(); (document.activeElement === cancel ? confirm : cancel).focus() }
  }
  panel.append(heading, cancel, confirm); backdrop.append(panel); document.body.append(backdrop); cancel.focus()
}
