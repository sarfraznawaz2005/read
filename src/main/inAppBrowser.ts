import { BrowserWindow, WebContentsView, ipcMain, clipboard, shell } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import type { BrowserChromeState } from '@shared/types'

const TOOLBAR_HEIGHT = 40

interface BrowserEntry {
  win: BrowserWindow
  view: WebContentsView
}

const windows = new Map<number, BrowserEntry>()
let handlersRegistered = false

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function entryForSender(event: Electron.IpcMainEvent): BrowserEntry | undefined {
  const win = BrowserWindow.fromWebContents(event.sender)
  return win ? windows.get(win.id) : undefined
}

function sendState(entry: BrowserEntry): void {
  const wc = entry.view.webContents
  const state: BrowserChromeState = {
    url: wc.getURL(),
    title: wc.getTitle(),
    canGoBack: wc.navigationHistory.canGoBack(),
    canGoForward: wc.navigationHistory.canGoForward(),
    loading: wc.isLoading()
  }
  entry.win.webContents.send('browser-chrome:state', state)
}

function registerControlHandlers(): void {
  if (handlersRegistered) return
  handlersRegistered = true

  ipcMain.on('browser-chrome:back', (event) => {
    const entry = entryForSender(event)
    if (entry?.view.webContents.navigationHistory.canGoBack()) {
      entry.view.webContents.navigationHistory.goBack()
    }
  })
  ipcMain.on('browser-chrome:forward', (event) => {
    const entry = entryForSender(event)
    if (entry?.view.webContents.navigationHistory.canGoForward()) {
      entry.view.webContents.navigationHistory.goForward()
    }
  })
  ipcMain.on('browser-chrome:reload', (event) => {
    entryForSender(event)?.view.webContents.reload()
  })
  ipcMain.on('browser-chrome:close', (event) => {
    entryForSender(event)?.win.close()
  })
  ipcMain.on('browser-chrome:copyLink', (_event, url: unknown) => {
    if (typeof url === 'string' && url) clipboard.writeText(url)
  })
  ipcMain.on('browser-chrome:openExternal', (event, url: unknown) => {
    if (typeof url !== 'string' || !isHttpUrl(url)) return
    const entry = entryForSender(event)
    if (entry) void shell.openExternal(url)
  })
}

export function openInAppBrowser(url: string, parent: BrowserWindow | null): void {
  if (!isHttpUrl(url)) return
  registerControlHandlers()

  const win = new BrowserWindow({
    width: 1100,
    height: 750,
    parent: parent ?? undefined,
    title: 'Read!',
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/browserChrome.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })

  win.once('ready-to-show', () => {
    win.show()
  })

  const view = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  })
  win.contentView.addChildView(view)

  function layout(): void {
    const [width, height] = win.getContentSize()
    view.setBounds({
      x: 0,
      y: TOOLBAR_HEIGHT,
      width,
      height: Math.max(0, height - TOOLBAR_HEIGHT)
    })
  }
  layout()
  win.on('resize', layout)

  // Links clicked inside the in-app browser (e.g. target="_blank") navigate
  // this same view instead of spawning new OS-level windows. But window.open()
  // popups (disposition 'new-window'), the pattern OAuth sign-in flows use,
  // get a real child window instead - see the matching comment in
  // embeddedView.ts for why squashing those breaks login.
  view.webContents.setWindowOpenHandler(({ url: targetUrl, disposition }) => {
    if (!isHttpUrl(targetUrl)) return { action: 'deny' }
    if (disposition === 'new-window') {
      return { action: 'allow', overrideBrowserWindowOptions: { autoHideMenuBar: true } }
    }
    void view.webContents.loadURL(targetUrl)
    return { action: 'deny' }
  })

  const entry: BrowserEntry = { win, view }
  windows.set(win.id, entry)
  win.on('closed', () => {
    windows.delete(win.id)
    // WebContentsView is not auto-destroyed when its parent BrowserWindow closes -
    // without this, the embedded page keeps running in the background.
    if (!view.webContents.isDestroyed()) {
      view.webContents.close()
    }
  })

  const onStateChange = (): void => sendState(entry)
  view.webContents.on('did-navigate', onStateChange)
  view.webContents.on('did-navigate-in-page', onStateChange)
  view.webContents.on('page-title-updated', onStateChange)
  view.webContents.on('did-start-loading', onStateChange)
  view.webContents.on('did-stop-loading', onStateChange)

  win.webContents.on('did-finish-load', () => {
    layout()
    sendState(entry)
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/browser-chrome.html`)
  } else {
    win.loadFile(join(__dirname, '../renderer/browser-chrome.html'))
  }

  view.webContents.loadURL(url).catch(() => {})
}

export function createBrowserHandlers(
  getParent: () => BrowserWindow | null
): Record<string, (event: unknown, url: string) => void> {
  return {
    'browser:open': (_event: unknown, url: string): void => openInAppBrowser(url, getParent()),
    'browser:openExternal': (_event: unknown, url: string): void => {
      if (isHttpUrl(url)) void shell.openExternal(url)
    }
  }
}
