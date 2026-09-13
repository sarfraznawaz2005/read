import { Notification } from 'electron'
import { getMainWindow } from './windowRegistry'

export function showDesktopNotification(title: string, body: string, onClick?: () => void): void {
  if (!Notification.isSupported()) return

  const notification = new Notification({ title, body })
  notification.on('click', () => {
    const win = getMainWindow()
    if (win) {
      if (win.isMinimized()) win.restore()
      if (!win.isVisible()) win.show()
      win.focus()
    }
    onClick?.()
  })
  notification.show()
}
