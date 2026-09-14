import { Notification } from 'electron'
import { getMainWindow } from './windowRegistry'

// Electron on Windows can garbage-collect a Notification with no surviving
// reference before the user clicks it, silently dropping the 'click' event.
// Keeping it in this set until it closes prevents that.
const activeNotifications = new Set<Notification>()

export function showDesktopNotification(title: string, body: string, onClick?: () => void): void {
  if (!Notification.isSupported()) return

  const notification = new Notification({ title, body })
  activeNotifications.add(notification)
  notification.on('click', () => {
    const win = getMainWindow()
    if (win) {
      if (win.isMinimized()) win.restore()
      if (!win.isVisible()) win.show()
      win.focus()
    }
    onClick?.()
  })
  notification.on('close', () => {
    activeNotifications.delete(notification)
  })
  notification.show()
}
