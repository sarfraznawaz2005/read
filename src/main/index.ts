import { app, BrowserWindow } from 'electron'
import { join } from 'path'
import windowStateKeeper from 'electron-window-state'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { initDb } from './db'
import { registerIpcHandlers } from './ipc'
import { articleHandlers } from './modules/articles/handlers'
import { categoryHandlers } from './modules/categories/handlers'
import { highlightHandlers } from './modules/highlights/handlers'
import { feedHandlers } from './modules/feeds/handlers'
import { scanAllFeeds } from './modules/feeds/scanService'
import { settingsHandlers } from './modules/settings/handlers'
import { analyticsHandlers } from './modules/analytics/handlers'
import { getSettings } from './modules/settings/repository'
import { performBackup } from './modules/settings/backupService'
import { ensureTray } from './tray'
import { createBrowserHandlers, openInAppBrowser } from './inAppBrowser'
import {
  createEmbeddedHandlers,
  destroyEmbedded,
  registerEmbeddedViewHandlers
} from './embeddedView'
import { setMainWindow } from './windowRegistry'

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

app.setName('read-app')

let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const windowState = windowStateKeeper({ defaultWidth: 1100, defaultHeight: 720 })

  const win = new BrowserWindow({
    x: windowState.x,
    y: windowState.y,
    width: windowState.width,
    height: windowState.height,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })
  mainWindow = win
  setMainWindow(win)

  windowState.manage(win)

  win.on('ready-to-show', () => {
    win.show()
  })

  win.on('minimize', () => {
    if (getSettings().minimizeToTray) {
      win.hide()
      ensureTray(win)
    }
  })

  win.on('close', (event) => {
    if (!isQuitting && getSettings().closeToTray) {
      event.preventDefault()
      win.hide()
      ensureTray(win)
    }
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isHttpUrl(url)) openInAppBrowser(url, win)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (event, url) => {
    if (url !== win.webContents.getURL()) {
      event.preventDefault()
    }
  })

  win.on('closed', () => {
    destroyEmbedded()
    if (mainWindow === win) {
      mainWindow = null
      setMainWindow(null)
    }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

let isQuitting = false

function scheduleFeedRefresh(): void {
  const minutes = Math.max(5, getSettings().feedScanIntervalMinutes)
  setTimeout(
    () => {
      void scanAllFeeds('auto')
        .catch(() => {})
        .finally(scheduleFeedRefresh)
    },
    minutes * 60 * 1000
  )
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.readapp.desktop')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  initDb()
  registerIpcHandlers(
    articleHandlers,
    categoryHandlers,
    highlightHandlers,
    feedHandlers,
    settingsHandlers,
    analyticsHandlers,
    createBrowserHandlers(() => mainWindow),
    createEmbeddedHandlers(() => mainWindow)
  )
  registerEmbeddedViewHandlers(() => mainWindow)

  app.setLoginItemSettings({ openAtLogin: getSettings().startWithWindows })

  createWindow()
  scheduleFeedRefresh()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('before-quit', (event) => {
  if (isQuitting) return
  isQuitting = true
  event.preventDefault()
  destroyEmbedded()
  performBackup()
    .catch(() => {})
    .finally(() => app.quit())
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
