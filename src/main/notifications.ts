import { Notification } from 'electron'
import { getMainWindow } from './windowRegistry'

export function showDesktopNotification(title: string, body: string): void {
  if (!Notification.isSupported()) return

  const notification = new Notification({ title, body })
  notification.on('click', () => {
    const win = getMainWindow()
    if (!win) return
    if (win.isMinimized()) win.restore()
    if (!win.isVisible()) win.show()
    win.focus()
  })
  notification.show()
}
