import { useEffect, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { ArticleCard } from './components/ArticleCard'
import { AddArticleDialog } from './components/AddArticleDialog'
import { ReaderView } from './components/ReaderView'
import { LibraryToolbar } from './components/LibraryToolbar'
import { FeedReaderView } from './components/FeedReaderView'
import { SettingsView } from './components/SettingsView'
import { AnalyticsView } from './components/AnalyticsView'
import { useAppStore } from './store/appStore'
import { useSettingsStore } from './store/settingsStore'
import { useFeedStore } from './store/feedStore'

const VIEW_MODE_KEY = 'read:libraryViewMode'

function loadStoredViewMode(): 'card' | 'list' {
  return localStorage.getItem(VIEW_MODE_KEY) === 'list' ? 'list' : 'card'
}

function App(): React.JSX.Element {
  const { articles, loading, toast, clearToast, loadArticles, loadCategories } = useAppStore()
  const { settings, loadSettings } = useSettingsStore()
  const { loadFeeds } = useFeedStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [openArticleId, setOpenArticleId] = useState<string | null>(null)
  const [feedsOpen, setFeedsOpen] = useState(false)
  const [viewMode, setViewModeState] = useState<'card' | 'list'>(loadStoredViewMode)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)

  function setViewMode(mode: 'card' | 'list'): void {
    setViewModeState(mode)
    localStorage.setItem(VIEW_MODE_KEY, mode)
  }

  useEffect(() => {
    void loadCategories()
    void loadArticles()
    void loadSettings()
    void loadFeeds()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', settings?.theme === 'dark')
  }, [settings?.theme])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(clearToast, 5000)
    return () => clearTimeout(timer)
  }, [toast, clearToast])

  // A single delegated handler so any external link anywhere in the React UI
  // (feeds, analytics, library) opens in the in-app browser, matching ReaderView.
  useEffect(() => {
    function handleClick(event: MouseEvent): void {
      const link = (event.target as HTMLElement).closest('a')
      if (!link) return
      const href = link.getAttribute('href')
      if (!href || href.startsWith('#')) return
      if (!/^https?:\/\//i.test(href)) return
      event.preventDefault()
      void window.api.browser.open(href)
    }
    document.addEventListener('click', handleClick)
    return () => document.removeEventListener('click', handleClick)
  }, [])

  const openArticle = articles.find((a) => a.id === openArticleId) ?? null

  if (settingsOpen) {
    return <SettingsView onBack={() => setSettingsOpen(false)} />
  }

  if (analyticsOpen) {
    return <AnalyticsView onBack={() => setAnalyticsOpen(false)} />
  }

  if (feedsOpen) {
    return (
      <FeedReaderView
        onBack={() => {
          setFeedsOpen(false)
          void loadArticles()
        }}
      />
    )
  }

  if (openArticle) {
    return <ReaderView article={openArticle} onBack={() => setOpenArticleId(null)} />
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-200">
      <Sidebar
        onAddClick={() => setDialogOpen(true)}
        onOpenFeeds={() => setFeedsOpen(true)}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenAnalytics={() => setAnalyticsOpen(true)}
      />
      <main className="flex-1 overflow-y-auto p-6">
        <LibraryToolbar viewMode={viewMode} onChangeViewMode={setViewMode} />
        {toast && (
          <div
            className={`fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-lg px-4 py-2.5 text-xs font-medium shadow-lg ${
              toast.type === 'success'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/90 dark:text-emerald-200'
                : 'bg-rose-50 text-rose-600 dark:bg-rose-900/90 dark:text-rose-200'
            }`}
          >
            {toast.message}
          </div>
        )}
        {loading && articles.length === 0 && (
          <p className="mt-6 text-sm text-slate-400">Loading…</p>
        )}
        {!loading && articles.length === 0 && (
          <div className="mt-6 flex flex-col items-start gap-1">
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">
              No articles yet.
            </p>
            <p className="text-sm text-slate-400">Save your first link to get started.</p>
          </div>
        )}
        <div
          className={
            viewMode === 'card'
              ? 'grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
              : 'flex flex-col gap-2'
          }
        >
          {articles.map((article) => (
            <ArticleCard
              key={article.id}
              article={article}
              onOpen={setOpenArticleId}
              view={viewMode}
            />
          ))}
        </div>
      </main>
      {dialogOpen && <AddArticleDialog onClose={() => setDialogOpen(false)} />}
    </div>
  )
}

export default App
