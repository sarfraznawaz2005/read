import { app, BrowserWindow, Menu, Tray, nativeImage, type NativeImage } from 'electron'
import icon from '../../resources/icon.png?asset'
import { getTotalUnreadCount } from './modules/feeds/repository'

let tray: Tray | null = null
let baseIcon: NativeImage | null = null
let unreadIcon: NativeImage | null = null
let hasUnread = false

const TRAY_ICON_SIZE = 32
const DOT_RADIUS = 9

function getBaseIcon(): NativeImage {
  if (!baseIcon) {
    baseIcon = nativeImage
      .createFromPath(icon)
      .resize({ width: TRAY_ICON_SIZE, height: TRAY_ICON_SIZE, quality: 'best' })
  }
  return baseIcon
}

// Draws a red dot badge onto a copy of the base icon's raw pixels (BGRA on this platform).
function getUnreadIcon(): NativeImage {
  if (!unreadIcon) {
    const base = getBaseIcon()
    const { width, height } = base.getSize()
    const buffer = Buffer.from(base.toBitmap())
    const cx = width - DOT_RADIUS - 1
    const cy = height - DOT_RADIUS - 1
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const dx = x - cx
        const dy = y - cy
        if (dx * dx + dy * dy <= DOT_RADIUS * DOT_RADIUS) {
          const idx = (y * width + x) * 4
          buffer[idx] = 40
          buffer[idx + 1] = 40
          buffer[idx + 2] = 220
          buffer[idx + 3] = 255
        }
      }
    }
    unreadIcon = nativeImage.createFromBitmap(buffer, { width, height })
  }
  return unreadIcon
}

function applyTrayIcon(): void {
  if (!tray) return
  tray.setImage(hasUnread ? getUnreadIcon() : getBaseIcon())
  tray.setToolTip(hasUnread ? 'Read! - unread feed items' : 'Read!')
}

export function refreshTrayUnreadState(): void {
  hasUnread = getTotalUnreadCount() > 0
  applyTrayIcon()
}

export function ensureTray(mainWindow: BrowserWindow): Tray {
  if (tray) return tray

  tray = new Tray(getBaseIcon())
  tray.setToolTip('Read!')
  tray.setContextMenu(
    Menu.buildFromTemplate([
      {
        label: 'Open Read!',
        click: () => {
          mainWindow.show()
        }
      },
      {
        label: 'Quit',
        click: () => {
          app.quit()
        }
      }
    ])
  )
  tray.on('click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide()
    } else {
      mainWindow.show()
    }
  })

  applyTrayIcon()
  return tray
}
