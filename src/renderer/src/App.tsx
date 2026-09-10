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

function App(): React.JSX.Element {
  const { articles, loading, error, loadArticles, loadCategories } = useAppStore()
  const { settings, loadSettings } = useSettingsStore()
  const { loadFeeds } = useFeedStore()
  const [dialogOpen, setDialogOpen] = useState(false)
  const [openArticleId, setOpenArticleId] = useState<string | null>(null)
  const [feedsOpen, setFeedsOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)

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
        <LibraryToolbar />
        {error && (
          <div className="mb-4 rounded-lg bg-rose-50 px-3 py-2 text-xs text-rose-600 dark:bg-rose-900/40 dark:text-rose-300">
            {error}
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
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {articles.map((article) => (
            <ArticleCard key={article.id} article={article} onOpen={setOpenArticleId} />
          ))}
        </div>
      </main>
      {dialogOpen && <AddArticleDialog onClose={() => setDialogOpen(false)} />}
    </div>
  )
}

export default App
