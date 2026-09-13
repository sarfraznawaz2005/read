import { useEffect, useRef, useState } from 'react'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Copy,
  Download,
  Link,
  ListChecks,
  Newspaper,
  Pencil,
  RotateCw,
  Trash2
} from 'lucide-react'
import type { FeedItem } from '@shared/types'
import { useFeedStore } from '../store/feedStore'
import { useAppStore } from '../store/appStore'
import { useEmbeddedPage } from '../hooks/useEmbeddedPage'

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diffMs / (1000 * 60 * 60))
  if (hours < 1) return 'just now'
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function isHttpUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

const FEED_LIST_COLLAPSED_KEY = 'read:feedListCollapsed'

function loadStoredCollapsed(): boolean {
  return localStorage.getItem(FEED_LIST_COLLAPSED_KEY) === 'true'
}

export function FeedReaderView({ onBack }: { onBack: () => void }): React.JSX.Element {
  const {
    feeds,
    feedItems,
    selectedFeedId,
    loadFeeds,
    selectFeed,
    addFeed,
    deleteFeed,
    deleteFeeds,
    renameFeed,
    refreshAllFeeds,
    markItemRead,
    markItemUnread,
    markAllRead,
    saveItemToLibrary,
    error
  } = useFeedStore()
  const { categories, loadCategories } = useAppStore()

  const [collapsed, setCollapsedState] = useState(loadStoredCollapsed)

  function setCollapsed(value: boolean): void {
    setCollapsedState(value)
    localStorage.setItem(FEED_LIST_COLLAPSED_KEY, String(value))
  }
  const [addingFeed, setAddingFeed] = useState(false)
  const [feedUrlDraft, setFeedUrlDraft] = useState('')
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [saveCategoryId, setSaveCategoryId] = useState('')
  const [savingItem, setSavingItem] = useState(false)
  const [selectMode, setSelectMode] = useState(false)
  const [selectedFeedIds, setSelectedFeedIds] = useState<Set<string>>(new Set())
  const [refreshing, setRefreshing] = useState(false)
  const [feedContextMenu, setFeedContextMenu] = useState<{
    x: number
    y: number
    feedId: string
  } | null>(null)
  const [renamingFeedId, setRenamingFeedId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const feedMenuRef = useRef<HTMLDivElement>(null)
  const [itemContextMenu, setItemContextMenu] = useState<{
    x: number
    y: number
    itemId: string
  } | null>(null)
  const itemMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!feedContextMenu) return
    const dismiss = (event: Event): void => {
      if (feedMenuRef.current?.contains(event.target as Node)) return
      setFeedContextMenu(null)
    }
    document.addEventListener('mousedown', dismiss)
    document.addEventListener('scroll', dismiss, true)
    return () => {
      document.removeEventListener('mousedown', dismiss)
      document.removeEventListener('scroll', dismiss, true)
    }
  }, [feedContextMenu])

  useEffect(() => {
    if (!itemContextMenu) return
    const dismiss = (event: Event): void => {
      if (itemMenuRef.current?.contains(event.target as Node)) return
      setItemContextMenu(null)
    }
    document.addEventListener('mousedown', dismiss)
    document.addEventListener('scroll', dismiss, true)
    return () => {
      document.removeEventListener('mousedown', dismiss)
      document.removeEventListener('scroll', dismiss, true)
    }
  }, [itemContextMenu])

  useEffect(() => {
    void loadFeeds()
    void loadCategories()
    void selectFeed(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectedFeed = feeds.find((f) => f.id === selectedFeedId) ?? null

  // Default view auto-selects the top (unread-first) item so the user can read
  // immediately, without overriding an explicit click as long as it still exists.
  const explicitSelectionValid = feedItems.some((item) => item.id === selectedItemId)
  const effectiveItemId = explicitSelectionValid ? selectedItemId : (feedItems[0]?.id ?? null)
  const selectedItem = feedItems.find((i) => i.id === effectiveItemId) ?? null

  useEffect(() => {
    if (selectedItem && !selectedItem.isRead) void markItemRead(selectedItem.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItem?.id])

  const embedUrl = selectedItem && isHttpUrl(selectedItem.link) ? selectedItem.link : null
  const { anchorRef, state: embedState, setVisible: setEmbedVisible } = useEmbeddedPage(embedUrl)

  function confirmBlocking(message: string): boolean {
    setEmbedVisible(false)
    const result = window.confirm(message)
    if (embedUrl) setEmbedVisible(true)
    return result
  }

  function submitAddFeed(): void {
    const url = feedUrlDraft.trim()
    if (url) void addFeed(url)
    setAddingFeed(false)
    setFeedUrlDraft('')
  }

  async function handleSaveToLibrary(): Promise<void> {
    if (!selectedItem) return
    setSavingItem(true)
    try {
      await saveItemToLibrary(selectedItem.id, saveCategoryId || undefined)
    } finally {
      setSavingItem(false)
    }
  }

  async function handleRefreshAll(): Promise<void> {
    setRefreshing(true)
    try {
      await refreshAllFeeds()
    } finally {
      setRefreshing(false)
    }
  }

  function toggleSelectMode(): void {
    setSelectMode((mode) => !mode)
    setSelectedFeedIds(new Set())
  }

  function toggleFeedSelected(feedId: string): void {
    setSelectedFeedIds((prev) => {
      const next = new Set(prev)
      if (next.has(feedId)) next.delete(feedId)
      else next.add(feedId)
      return next
    })
  }

  function selectAllBroken(): void {
    setSelectedFeedIds(new Set(feeds.filter((f) => f.lastError).map((f) => f.id)))
  }

  function startRenameFeed(feedId: string, currentTitle: string): void {
    setRenamingFeedId(feedId)
    setRenameValue(currentTitle)
    setFeedContextMenu(null)
  }

  function submitRenameFeed(): void {
    const title = renameValue.trim()
    const feedId = renamingFeedId
    setRenamingFeedId(null)
    if (feedId && title) void renameFeed(feedId, title)
  }

  function handleDeleteFeedFromMenu(feedId: string, title: string): void {
    setFeedContextMenu(null)
    if (confirmBlocking(`Unsubscribe from "${title}"?`)) void deleteFeed(feedId)
  }

  function handleToggleItemReadFromMenu(item: FeedItem): void {
    setItemContextMenu(null)
    if (item.isRead) void markItemUnread(item.id)
    else void markItemRead(item.id)
  }

  function handleSaveItemFromMenu(item: FeedItem): void {
    setItemContextMenu(null)
    if (!item.savedArticleId) void saveItemToLibrary(item.id)
  }

  function handleCopyItemLink(item: FeedItem): void {
    setItemContextMenu(null)
    void navigator.clipboard.writeText(item.link)
  }

  function handleOpenItemInBrowser(item: FeedItem): void {
    setItemContextMenu(null)
    void window.api.browser.open(item.link)
  }

  async function handleDeleteSelected(): Promise<void> {
    if (selectedFeedIds.size === 0) return
    if (!confirmBlocking(`Unsubscribe from ${selectedFeedIds.size} feed(s)?`)) return
    await deleteFeeds(Array.from(selectedFeedIds))
    setSelectMode(false)
    setSelectedFeedIds(new Set())
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-200">
      {/* Pane 1: feeds list */}
      <aside
        className={`flex flex-shrink-0 flex-col border-r border-slate-200 bg-slate-50 transition-all dark:border-slate-800 dark:bg-slate-950 ${
          collapsed ? 'w-10' : 'w-[200px]'
        }`}
      >
        <div
          className={`grid grid-cols-[auto_1fr_auto] items-center border-b border-slate-200 dark:border-slate-800 ${
            collapsed ? 'px-1 py-3' : 'p-3'
          }`}
        >
          {!collapsed ? (
            <button
              title="Select feeds to delete"
              onClick={toggleSelectMode}
              className={`inline-flex items-center justify-center rounded p-1 font-bold hover:bg-slate-200 ${selectMode ? 'text-indigo-600' : 'text-slate-500'}`}
            >
              <ListChecks className="h-4 w-4" />
            </button>
          ) : (
            <span />
          )}
          {!collapsed ? (
            <button
              title="Add feed"
              onClick={() => setAddingFeed(true)}
              className="justify-self-center rounded p-1 text-sm font-bold text-slate-500 hover:bg-slate-200"
            >
              +
            </button>
          ) : (
            <span />
          )}
          <button
            title={collapsed ? 'Expand' : 'Collapse'}
            onClick={() => setCollapsed(!collapsed)}
            className={`inline-flex items-center justify-center rounded text-slate-500 hover:bg-slate-200 ${
              collapsed ? 'col-span-3 justify-self-center p-0.5' : 'justify-self-end p-1'
            }`}
          >
            {collapsed ? (
              <ChevronRight className="h-3.5 w-3.5" />
            ) : (
              <ChevronLeft className="h-3.5 w-3.5" />
            )}
          </button>
        </div>

        {!collapsed && (
          <>
            {selectMode && (
              <div className="flex items-center gap-2 border-b border-slate-200 bg-amber-50 p-2 text-[11px] dark:border-slate-800 dark:bg-amber-950/40">
                <button
                  onClick={selectAllBroken}
                  className="text-amber-700 hover:underline dark:text-amber-300"
                >
                  Select all broken
                </button>
                <button
                  onClick={handleDeleteSelected}
                  disabled={selectedFeedIds.size === 0}
                  className="ml-auto rounded bg-rose-600 px-2 py-1 font-medium text-white disabled:opacity-40"
                >
                  Delete ({selectedFeedIds.size})
                </button>
              </div>
            )}
            <div className="flex-1 space-y-0.5 overflow-y-auto py-2">
              {addingFeed && (
                <div className="px-3">
                  <input
                    autoFocus
                    value={feedUrlDraft}
                    onChange={(event) => setFeedUrlDraft(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') submitAddFeed()
                      if (event.key === 'Escape') {
                        setAddingFeed(false)
                        setFeedUrlDraft('')
                      }
                    }}
                    onBlur={() => {
                      setAddingFeed(false)
                      setFeedUrlDraft('')
                    }}
                    placeholder="https://example.com/feed.xml"
                    className="w-full rounded border border-indigo-300 px-2 py-1.5 text-xs focus:outline-none dark:border-indigo-700 dark:bg-slate-900 dark:text-slate-200"
                  />
                </div>
              )}

              {!selectMode && (
                <button
                  onClick={() => {
                    void selectFeed(null)
                    setSelectedItemId(null)
                  }}
                  className={`flex w-full items-center justify-between px-3 py-1.5 text-xs ${
                    selectedFeedId === null
                      ? 'bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                      : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-1.5">
                    <Newspaper className="h-3.5 w-3.5" />
                    All Entries
                  </span>
                </button>
              )}

              {feeds.map((feed) =>
                renamingFeedId === feed.id ? (
                  <div key={feed.id} className="px-3">
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') submitRenameFeed()
                        if (event.key === 'Escape') setRenamingFeedId(null)
                      }}
                      onBlur={submitRenameFeed}
                      className="w-full rounded border border-indigo-300 px-2.5 py-1.5 text-xs focus:outline-none dark:border-indigo-700 dark:bg-slate-900 dark:text-slate-200"
                    />
                  </div>
                ) : (
                  <div
                    key={feed.id}
                    onContextMenu={(event) => {
                      if (selectMode) return
                      event.preventDefault()
                      setFeedContextMenu({ x: event.clientX, y: event.clientY, feedId: feed.id })
                    }}
                    className={`group flex items-center justify-between px-3 py-1.5 text-xs ${
                      selectedFeedId === feed.id
                        ? 'bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                        : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                    }`}
                  >
                    {selectMode && (
                      <input
                        type="checkbox"
                        checked={selectedFeedIds.has(feed.id)}
                        onChange={() => toggleFeedSelected(feed.id)}
                        className="mr-2 h-3.5 w-3.5 flex-shrink-0"
                      />
                    )}
                    <button
                      onClick={() => {
                        if (selectMode) {
                          toggleFeedSelected(feed.id)
                          return
                        }
                        void selectFeed(feed.id)
                        setSelectedItemId(null)
                      }}
                      title={feed.lastError ?? undefined}
                      className={`flex-1 truncate text-left ${
                        feed.lastError ? 'font-bold text-rose-600 dark:text-rose-400' : ''
                      }`}
                    >
                      {feed.lastError && (
                        <AlertTriangle className="mr-1 inline h-3 w-3 flex-shrink-0" />
                      )}
                      {feed.title}
                    </button>
                    {feed.unreadCount > 0 && (
                      <span className="rounded bg-indigo-600 px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                        {feed.unreadCount}
                      </span>
                    )}
                  </div>
                )
              )}
              {feeds.length === 0 && !addingFeed && (
                <p className="px-2 py-4 text-center text-xs text-slate-400">
                  No feeds yet. Click + to subscribe.
                </p>
              )}
            </div>
          </>
        )}
      </aside>

      {feedContextMenu && (
        <div
          ref={feedMenuRef}
          className="fixed z-50 w-40 rounded-xl border border-slate-200 bg-white py-1.5 text-xs text-slate-700 shadow-2xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          style={{ left: feedContextMenu.x, top: feedContextMenu.y }}
        >
          <button
            onClick={() => {
              const feed = feeds.find((f) => f.id === feedContextMenu.feedId)
              if (feed) startRenameFeed(feed.id, feed.title)
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white"
          >
            <Pencil className="h-3.5 w-3.5" />
            Rename
          </button>
          <button
            onClick={() => {
              const feed = feeds.find((f) => f.id === feedContextMenu.feedId)
              if (feed) handleDeleteFeedFromMenu(feed.id, feed.title)
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-rose-600 hover:bg-rose-600 hover:text-white"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </button>
        </div>
      )}

      {/* Pane 2: feed items */}
      <section className="flex w-80 flex-shrink-0 flex-col border-r border-slate-200 dark:border-slate-800">
        <div className="grid grid-cols-[auto_1fr_auto] items-center gap-2 border-b border-slate-200 p-3 dark:border-slate-800">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Library
          </button>
          <span className="text-center text-xs font-bold text-slate-500 dark:text-slate-400">
            Articles ({feedItems.length})
          </span>
          <div className="flex items-center gap-2 justify-self-end">
            <button
              title="Mark all as read"
              onClick={() => void markAllRead(selectedFeedId ?? undefined)}
              disabled={feedItems.every((item) => item.isRead)}
              className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-black hover:bg-slate-200 disabled:opacity-70 dark:text-white dark:hover:bg-slate-800"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              title="Refresh all feeds"
              onClick={handleRefreshAll}
              disabled={refreshing}
              className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-slate-500 hover:bg-slate-200 disabled:opacity-50 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              {refreshing ? '…' : <RotateCw className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>
        <div className="flex-1 divide-y divide-slate-300 overflow-y-auto dark:divide-slate-700">
          {feedItems.length === 0 && (
            <p className="p-4 text-center text-xs text-slate-400">
              {selectedFeed ? 'No articles in this feed yet.' : 'No articles yet.'}
            </p>
          )}
          {feedItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setSelectedItemId(item.id)}
              onContextMenu={(event) => {
                event.preventDefault()
                setItemContextMenu({ x: event.clientX, y: event.clientY, itemId: item.id })
              }}
              className={`block w-full px-3.5 py-2 text-left ${
                effectiveItemId === item.id
                  ? 'bg-yellow-50 dark:bg-yellow-900/30'
                  : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
              }`}
            >
              {(() => {
                const hasMeta = (!selectedFeedId && !!item.feedTitle) || !!item.savedArticleId
                const title = (
                  <h4
                    className={`text-sm leading-snug ${
                      item.isRead
                        ? 'font-normal text-slate-800 dark:text-slate-200'
                        : 'font-semibold text-blue-600 dark:text-blue-400'
                    }`}
                  >
                    {item.title ?? item.link}
                  </h4>
                )
                if (!hasMeta) {
                  return (
                    <div className="flex items-baseline justify-between gap-2">
                      {title}
                      <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
                        {timeAgo(item.publishedAt)}
                      </span>
                    </div>
                  )
                }
                return (
                  <>
                    <div className="mb-0.5 flex items-center justify-between text-xs text-slate-600 dark:text-slate-300">
                      <span className="flex items-center gap-1.5">
                        {!selectedFeedId && item.feedTitle && (
                          <span className="truncate">{item.feedTitle}</span>
                        )}
                        {item.savedArticleId && (
                          <span className="flex items-center gap-1">
                            <Check className="h-3 w-3" />
                            Saved
                          </span>
                        )}
                      </span>
                      <span>{timeAgo(item.publishedAt)}</span>
                    </div>
                    {title}
                  </>
                )
              })()}
            </button>
          ))}
        </div>
      </section>

      {itemContextMenu &&
        (() => {
          const item = feedItems.find((i) => i.id === itemContextMenu.itemId)
          if (!item) return null
          return (
            <div
              ref={itemMenuRef}
              className="fixed z-50 w-44 rounded-xl border border-slate-200 bg-white py-1.5 text-xs text-slate-700 shadow-2xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
              style={{ left: itemContextMenu.x, top: itemContextMenu.y }}
            >
              <button
                onClick={() => handleToggleItemReadFromMenu(item)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white"
              >
                {item.isRead ? (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                ) : (
                  <Circle className="h-3.5 w-3.5" />
                )}
                {item.isRead ? 'Mark Unread' : 'Mark Read'}
              </button>
              <button
                disabled={!!item.savedArticleId}
                onClick={() => handleSaveItemFromMenu(item)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-700"
              >
                {item.savedArticleId ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Download className="h-3.5 w-3.5" />
                )}
                {item.savedArticleId ? 'Saved' : 'Save to Library'}
              </button>
              <button
                onClick={() => handleCopyItemLink(item)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy Link
              </button>
              <button
                onClick={() => handleOpenItemInBrowser(item)}
                className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white"
              >
                <Link className="h-3.5 w-3.5" />
                Open in Browser
              </button>
            </div>
          )
        })()}

      {/* Pane 3: live page */}
      <main className="flex flex-1 flex-col overflow-hidden">
        {error && (
          <div className="bg-rose-50 px-4 py-2 text-xs text-rose-600 dark:bg-rose-900/40 dark:text-rose-300">
            {error}
          </div>
        )}
        {selectedItem ? (
          <>
            <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
              <div className="min-w-0">
                <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400">
                  {selectedItem.title ?? selectedItem.link}
                </span>
                <div className="truncate text-xs text-slate-500 dark:text-slate-400">
                  {selectedItem.feedTitle ?? selectedFeed?.title}
                </div>
              </div>
              <div className="flex flex-shrink-0 items-center gap-2">
                <select
                  value={saveCategoryId}
                  onChange={(event) => setSaveCategoryId(event.target.value)}
                  className="rounded-lg border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
                >
                  <option value="">Default</option>
                  {categories
                    .filter((c) => !c.isDefault)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
                <button
                  onClick={handleSaveToLibrary}
                  disabled={savingItem || !!selectedItem.savedArticleId}
                  className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white shadow hover:bg-emerald-500 disabled:opacity-50"
                >
                  {selectedItem.savedArticleId ? (
                    <Check className="h-3.5 w-3.5" />
                  ) : (
                    !savingItem && <Download className="h-3.5 w-3.5" />
                  )}
                  {selectedItem.savedArticleId
                    ? 'Saved'
                    : savingItem
                      ? 'Saving…'
                      : 'Save to Library'}
                </button>
              </div>
            </div>

            {embedUrl ? (
              <>
                <div className="flex flex-shrink-0 items-center gap-2 border-b border-slate-200 bg-slate-100 px-3 py-1.5 text-xs dark:border-slate-800 dark:bg-slate-950">
                  <button
                    disabled={!embedState.canGoBack}
                    onClick={() => window.api.embed.back()}
                    className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-slate-600 hover:bg-slate-200 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <ArrowLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    disabled={!embedState.canGoForward}
                    onClick={() => window.api.embed.forward()}
                    className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-slate-600 hover:bg-slate-200 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => window.api.embed.reload()}
                    className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <RotateCw className="h-3.5 w-3.5" />
                  </button>
                  <span className="flex min-w-0 flex-1 items-center gap-1.5 truncate text-[11px] text-slate-400">
                    {embedState.loading && (
                      <span className="h-2.5 w-2.5 flex-shrink-0 animate-spin rounded-full border-2 border-slate-300 border-t-indigo-500 dark:border-slate-600 dark:border-t-indigo-400" />
                    )}
                    <span className="truncate">
                      {embedState.loading ? 'Loading…' : embedState.url || embedUrl}
                    </span>
                  </span>
                  <button
                    onClick={() => window.api.embed.copyLink()}
                    title="Copy link"
                    className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Copy className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => void window.api.embed.openInWindow()}
                    title="Open in browser window"
                    className="inline-flex items-center justify-center rounded px-1.5 py-0.5 text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
                  >
                    <Link className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="relative min-h-0 flex-1">
                  <div ref={anchorRef} className="absolute inset-0" />
                  {embedState.loading && (
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-3 bg-white dark:bg-slate-900">
                      <span className="h-8 w-8 animate-spin rounded-full border-[3px] border-slate-200 border-t-indigo-500 dark:border-slate-700 dark:border-t-indigo-400" />
                      <span className="text-xs text-slate-400">Loading…</span>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <p className="flex-1 p-8 text-center text-sm text-slate-400">
                This item has no readable web link.
              </p>
            )}
          </>
        ) : (
          <p className="flex-1 p-8 text-center text-sm text-slate-400">
            Select an article to read it here.
          </p>
        )}
      </main>
    </div>
  )
}
