import { BrowserWindow, WebContentsView, ipcMain, clipboard, Menu } from 'electron'
import type { IpcMainEvent, MenuItemConstructorOptions } from 'electron'
import type { BrowserChromeState } from '@shared/types'
import { openInAppBrowser } from './inAppBrowser'

interface EmbedBounds {
  x: number
  y: number
  width: number
  height: number
}

let view: WebContentsView | null = null
let ownerWindow: BrowserWindow | null = null

// `view.webContents` can go undefined even while `view` itself is still set
// (the native side can tear it down without clearing our reference), so every
// liveness check must go through this instead of checking `view` alone.
function isViewAlive(v: WebContentsView | null): v is WebContentsView {
  return !!v && !!v.webContents && !v.webContents.isDestroyed()
}

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function sendState(win: BrowserWindow): void {
  if (!isViewAlive(view)) return
  const wc = view.webContents
  const state: BrowserChromeState = {
    url: wc.getURL(),
    title: wc.getTitle(),
    canGoBack: wc.navigationHistory.canGoBack(),
    canGoForward: wc.navigationHistory.canGoForward(),
    loading: wc.isLoading()
  }
  win.webContents.send('embed:state', state)
}

function ensureView(win: BrowserWindow): WebContentsView {
  if (isViewAlive(view)) return view

  const newView = new WebContentsView({
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      partition: 'persist:feedweb'
    }
  })
  view = newView
  ownerWindow = win
  win.contentView.addChildView(newView)

  const wc = newView.webContents

  // Links (e.g. target="_blank") navigate this same embedded view instead of
  // spawning a new window; anything non-http(s) is dropped.
  wc.setWindowOpenHandler(({ url }) => {
    if (isHttpUrl(url)) void wc.loadURL(url)
    return { action: 'deny' }
  })
  wc.on('will-navigate', (event, url) => {
    if (!isHttpUrl(url)) event.preventDefault()
  })
  wc.session.setPermissionRequestHandler((_contents, _permission, callback) => callback(false))

  const onStateChange = (): void => {
    if (ownerWindow && !ownerWindow.isDestroyed()) sendState(ownerWindow)
  }
  wc.on('did-navigate', onStateChange)
  wc.on('did-navigate-in-page', onStateChange)
  wc.on('page-title-updated', onStateChange)
  wc.on('did-start-loading', onStateChange)
  wc.on('did-stop-loading', onStateChange)
  wc.on('did-fail-load', onStateChange)

  // The pane renders a real web page (not React), so it needs its own native
  // right-click menu - React can't paint over a WebContentsView.
  wc.on('context-menu', (_event, params) => {
    const template: MenuItemConstructorOptions[] = []

    if (params.selectionText) {
      template.push({ label: 'Copy', role: 'copy' })
    }
    if (params.linkURL) {
      template.push({ label: 'Copy Link', click: () => clipboard.writeText(params.linkURL) })
      template.push({
        label: 'Open Link in Browser',
        click: () => {
          if (ownerWindow) openInAppBrowser(params.linkURL, ownerWindow)
        }
      })
    }
    if (template.length > 0) template.push({ type: 'separator' })
    template.push(
      {
        label: 'Back',
        enabled: wc.navigationHistory.canGoBack(),
        click: () => wc.navigationHistory.goBack()
      },
      {
        label: 'Forward',
        enabled: wc.navigationHistory.canGoForward(),
        click: () => wc.navigationHistory.goForward()
      },
      { label: 'Reload', click: () => wc.reload() },
      { label: 'Copy Page URL', click: () => clipboard.writeText(wc.getURL()) }
    )

    Menu.buildFromTemplate(template).popup({ window: ownerWindow ?? undefined })
  })

  return newView
}

export function destroyEmbedded(): void {
  if (view) {
    if (ownerWindow && !ownerWindow.isDestroyed()) {
      ownerWindow.contentView.removeChildView(view)
    }
    // WebContentsView is not auto-destroyed when detached - without this the
    // embedded page keeps running (and can keep playing audio) in the background.
    if (isViewAlive(view)) view.webContents.close()
  }
  view = null
  ownerWindow = null
}

function isFromOwner(event: IpcMainEvent, getWin: () => BrowserWindow | null): boolean {
  const win = getWin()
  return !!win && BrowserWindow.fromWebContents(event.sender) === win
}

export function createEmbeddedHandlers(
  getWin: () => BrowserWindow | null
): Record<string, (event: unknown, url?: string) => void> {
  return {
    'embed:show': (_event: unknown, url?: string): void => {
      const win = getWin()
      if (!win || !url || !isHttpUrl(url)) return
      const v = ensureView(win)
      v.webContents.loadURL(url).catch(() => {})
    },
    'embed:destroy': (): void => destroyEmbedded(),
    'embed:openInWindow': (): void => {
      const win = getWin()
      if (!win || !isViewAlive(view)) return
      openInAppBrowser(view.webContents.getURL(), win)
    }
  }
}

export function registerEmbeddedViewHandlers(getWin: () => BrowserWindow | null): void {
  function activeView(event: IpcMainEvent): WebContentsView | null {
    if (!isFromOwner(event, getWin)) return null
    return isViewAlive(view) ? view : null
  }

  ipcMain.on('embed:setBounds', (event, bounds: EmbedBounds) => {
    const v = activeView(event)
    if (!v) return
    v.setBounds({
      x: Math.max(0, Math.round(bounds.x)),
      y: Math.max(0, Math.round(bounds.y)),
      width: Math.max(0, Math.round(bounds.width)),
      height: Math.max(0, Math.round(bounds.height))
    })
  })

  ipcMain.on('embed:setVisible', (event, visible: boolean) => {
    const win = getWin()
    if (!isFromOwner(event, getWin) || !win || !isViewAlive(view)) return
    if (visible) win.contentView.addChildView(view)
    else win.contentView.removeChildView(view)
  })

  ipcMain.on('embed:back', (event) => {
    const v = activeView(event)
    if (v?.webContents.navigationHistory.canGoBack()) v.webContents.navigationHistory.goBack()
  })
  ipcMain.on('embed:forward', (event) => {
    const v = activeView(event)
    if (v?.webContents.navigationHistory.canGoForward()) v.webContents.navigationHistory.goForward()
  })
  ipcMain.on('embed:reload', (event) => {
    activeView(event)?.webContents.reload()
  })
  ipcMain.on('embed:copyLink', (event) => {
    const v = activeView(event)
    if (v) clipboard.writeText(v.webContents.getURL())
  })
}
