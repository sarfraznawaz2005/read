import { app, BrowserWindow, Menu, Tray } from 'electron'
import icon from '../../resources/icon.png?asset'

let tray: Tray | null = null

export function ensureTray(mainWindow: BrowserWindow): Tray {
  if (tray) return tray

  tray = new Tray(icon)
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

  return tray
}
