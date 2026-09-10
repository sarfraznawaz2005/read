export type ExtractionStatus = 'pending' | 'ok' | 'failed'

export interface Category {
  id: string
  name: string
  isDefault: boolean
  createdAt: string
}

export interface Article {
  id: string
  categoryId: string
  url: string
  title: string | null
  author: string | null
  contentHtml: string | null
  contentText: string | null
  images: string[]
  sourceDomain: string | null
  isRead: boolean
  isFavorite: boolean
  isArchived: boolean
  extractionStatus: ExtractionStatus
  extractionError: string | null
  savedAt: string
  lastOpenedAt: string | null
}

export type ArticleStatusFilter = 'all' | 'unread' | 'read' | 'favorite' | 'archived'
export type ArticleSort = 'date_desc' | 'date_asc' | 'title_asc' | 'read_status'

export interface ArticleListFilter {
  categoryId?: string
  status?: ArticleStatusFilter
  query?: string
  sort?: ArticleSort
}

export interface ArticleStatusPatch {
  isRead?: boolean
  isFavorite?: boolean
  isArchived?: boolean
  categoryId?: string
}

export const HIGHLIGHT_COLORS = ['yellow', 'green', 'rose', 'blue'] as const
export type HighlightColor = (typeof HIGHLIGHT_COLORS)[number]

export interface TextQuoteAnchor {
  exact: string
  prefix: string
  suffix: string
}

export interface Analytics {
  totalArticles: number
  readArticles: number
  readPercent: number
  streakDays: number
  perDay: { date: string; count: number }[]
  perCategory: { categoryId: string; categoryName: string; total: number; read: number }[]
  estReadingTimeMinutes: number
  totalHighlights: number
}

export interface AppSettings {
  theme: 'light' | 'dark'
  startWithWindows: boolean
  startMinimized: boolean
  minimizeToTray: boolean
  closeToTray: boolean
  backupFolderPath: string | null
  readerFontFamily: string
  readerFontSize: number
  readerBackground: string
  feedScanIntervalMinutes: number
  feedMaxEntriesPerFeed: number
  feedMaxAgeDays: number
  feedMaxTotalEntries: number
}

export interface BackupRecord {
  id: string
  filePath: string
  createdAt: string
}

export interface Feed {
  id: string
  title: string
  feedUrl: string
  siteUrl: string | null
  addedAt: string
  itemCount: number
  unreadCount: number
  lastCheckedAt: string | null
  lastError: string | null
  failureCount: number
}

export interface FeedItem {
  id: string
  feedId: string
  feedTitle?: string
  title: string | null
  link: string
  summary: string | null
  publishedAt: string | null
  fetchedAt: string
  savedArticleId: string | null
  isRead: boolean
  readAt: string | null
}

export interface FeedScanResult {
  newItems: number
  feedsScanned: number
  feedsFailed: number
}

export interface Highlight {
  id: string
  articleId: string
  color: HighlightColor
  anchor: TextQuoteAnchor
  selectedText: string
  comment: string | null
  createdAt: string
  updatedAt: string
}

export interface BrowserChromeState {
  url: string
  title: string
  canGoBack: boolean
  canGoForward: boolean
  loading: boolean
}
