import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import type {
  Analytics,
  AppSettings,
  Article,
  ArticleListFilter,
  ArticleStatusPatch,
  BackupRecord,
  BrowserChromeState,
  Category,
  Feed,
  FeedItem,
  FeedScanResult,
  Highlight,
  HighlightColor,
  TextQuoteAnchor
} from '@shared/types'

const api = {
  articles: {
    add: (url: string, categoryId?: string): Promise<Article> =>
      ipcRenderer.invoke('article:add', url, categoryId),
    retryExtraction: (articleId: string): Promise<Article> =>
      ipcRenderer.invoke('article:retryExtraction', articleId),
    list: (filter: ArticleListFilter = {}): Promise<Article[]> =>
      ipcRenderer.invoke('article:list', filter),
    markOpened: (articleId: string): Promise<Article> =>
      ipcRenderer.invoke('article:markOpened', articleId),
    delete: (articleId: string): Promise<void> => ipcRenderer.invoke('article:delete', articleId),
    updateStatus: (articleId: string, patch: ArticleStatusPatch): Promise<Article> =>
      ipcRenderer.invoke('article:updateStatus', articleId, patch)
  },
  categories: {
    list: (): Promise<Category[]> => ipcRenderer.invoke('category:list'),
    create: (name: string): Promise<Category> => ipcRenderer.invoke('category:create', name),
    rename: (id: string, name: string): Promise<Category> =>
      ipcRenderer.invoke('category:rename', id, name),
    delete: (id: string, reassignToId?: string): Promise<void> =>
      ipcRenderer.invoke('category:delete', id, reassignToId)
  },
  highlights: {
    listByArticle: (articleId: string): Promise<Highlight[]> =>
      ipcRenderer.invoke('highlight:listByArticle', articleId),
    add: (
      articleId: string,
      anchor: TextQuoteAnchor,
      color: HighlightColor,
      selectedText: string
    ): Promise<Highlight> =>
      ipcRenderer.invoke('highlight:add', articleId, anchor, color, selectedText),
    update: (id: string, color: HighlightColor): Promise<Highlight> =>
      ipcRenderer.invoke('highlight:update', id, color),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('highlight:delete', id),
    upsertComment: (highlightId: string, text: string): Promise<Highlight> =>
      ipcRenderer.invoke('comment:upsert', highlightId, text),
    deleteComment: (highlightId: string): Promise<Highlight> =>
      ipcRenderer.invoke('comment:delete', highlightId)
  },
  feeds: {
    add: (feedUrl: string): Promise<Feed> => ipcRenderer.invoke('feed:add', feedUrl),
    list: (): Promise<Feed[]> => ipcRenderer.invoke('feed:list'),
    listItems: (feedId: string): Promise<FeedItem[]> =>
      ipcRenderer.invoke('feed:listItems', feedId),
    listAllItems: (): Promise<FeedItem[]> => ipcRenderer.invoke('feed:listAllItems'),
    markItemRead: (feedItemId: string): Promise<FeedItem> =>
      ipcRenderer.invoke('feed:markItemRead', feedItemId),
    markItemUnread: (feedItemId: string): Promise<FeedItem> =>
      ipcRenderer.invoke('feed:markItemUnread', feedItemId),
    markAllRead: (feedId?: string): Promise<void> => ipcRenderer.invoke('feed:markAllRead', feedId),
    refresh: (feedId: string): Promise<number> => ipcRenderer.invoke('feed:refresh', feedId),
    refreshAll: (): Promise<FeedScanResult> => ipcRenderer.invoke('feed:refreshAll'),
    delete: (feedId: string): Promise<void> => ipcRenderer.invoke('feed:delete', feedId),
    deleteMany: (feedIds: string[]): Promise<void> =>
      ipcRenderer.invoke('feed:deleteMany', feedIds),
    rename: (feedId: string, title: string): Promise<Feed> =>
      ipcRenderer.invoke('feed:rename', feedId, title),
    saveItemToLibrary: (feedItemId: string, categoryId?: string): Promise<Article> =>
      ipcRenderer.invoke('feed:saveItemToLibrary', feedItemId, categoryId),
    onScanFinished: (callback: (result: FeedScanResult) => void): (() => void) => {
      const listener = (_event: unknown, result: FeedScanResult): void => callback(result)
      ipcRenderer.on('feeds:scanFinished', listener)
      return () => ipcRenderer.off('feeds:scanFinished', listener)
    }
  },
  opml: {
    import: (): Promise<{ added: number; skipped: number } | null> =>
      ipcRenderer.invoke('opml:import'),
    export: (): Promise<string | null> => ipcRenderer.invoke('opml:export')
  },
  embed: {
    show: (url: string): Promise<void> => ipcRenderer.invoke('embed:show', url),
    destroy: (): Promise<void> => ipcRenderer.invoke('embed:destroy'),
    openInWindow: (): Promise<void> => ipcRenderer.invoke('embed:openInWindow'),
    setBounds: (bounds: { x: number; y: number; width: number; height: number }): void =>
      ipcRenderer.send('embed:setBounds', bounds),
    setVisible: (visible: boolean): void => ipcRenderer.send('embed:setVisible', visible),
    back: (): void => ipcRenderer.send('embed:back'),
    forward: (): void => ipcRenderer.send('embed:forward'),
    reload: (): void => ipcRenderer.send('embed:reload'),
    copyLink: (): void => ipcRenderer.send('embed:copyLink'),
    onState: (callback: (state: BrowserChromeState) => void): (() => void) => {
      const listener = (_event: unknown, state: BrowserChromeState): void => callback(state)
      ipcRenderer.on('embed:state', listener)
      return () => ipcRenderer.off('embed:state', listener)
    }
  },
  settings: {
    get: (): Promise<AppSettings> => ipcRenderer.invoke('settings:get'),
    update: (patch: Partial<AppSettings>): Promise<AppSettings> =>
      ipcRenderer.invoke('settings:update', patch),
    pickBackupFolder: (): Promise<AppSettings | null> =>
      ipcRenderer.invoke('settings:pickBackupFolder'),
    import: (): Promise<AppSettings | null> => ipcRenderer.invoke('settings:import'),
    export: (): Promise<string | null> => ipcRenderer.invoke('settings:export')
  },
  backups: {
    now: (): Promise<BackupRecord | null> => ipcRenderer.invoke('backup:now'),
    list: (): Promise<BackupRecord[]> => ipcRenderer.invoke('backup:list')
  },
  analytics: {
    get: (): Promise<Analytics> => ipcRenderer.invoke('analytics:get')
  },
  browser: {
    open: (url: string): Promise<void> => ipcRenderer.invoke('browser:open', url),
    openExternal: (url: string): Promise<void> => ipcRenderer.invoke('browser:openExternal', url)
  }
}

export type Api = typeof api

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
