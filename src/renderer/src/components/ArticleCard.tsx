import { useEffect, useRef, useState } from 'react'
import type { Article } from '@shared/types'
import { useAppStore } from '../store/appStore'

export function ArticleCard({
  article,
  onOpen,
  view = 'card'
}: {
  article: Article
  onOpen: (articleId: string) => void
  view?: 'card' | 'list'
}): React.JSX.Element {
  const { updateStatus, retryExtraction, deleteArticle } = useAppStore()
  const canOpen = article.extractionStatus !== 'pending'
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!contextMenu) return
    const dismiss = (event: Event): void => {
      if (menuRef.current?.contains(event.target as Node)) return
      setContextMenu(null)
    }
    document.addEventListener('mousedown', dismiss)
    document.addEventListener('scroll', dismiss, true)
    return () => {
      document.removeEventListener('mousedown', dismiss)
      document.removeEventListener('scroll', dismiss, true)
    }
  }, [contextMenu])

  function handleDelete(): void {
    setContextMenu(null)
    if (window.confirm(`Delete "${article.title ?? article.url}"? This cannot be undone.`)) {
      void deleteArticle(article.id)
    }
  }

  const contextMenuEl = contextMenu && (
    <div
      ref={menuRef}
      className="fixed z-50 w-44 rounded-xl border border-slate-200 bg-white py-1.5 text-xs text-slate-700 shadow-2xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      style={{ left: contextMenu.x, top: contextMenu.y }}
    >
      <button
        onClick={() => {
          setContextMenu(null)
          void updateStatus(article.id, { isRead: !article.isRead })
        }}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white"
      >
        {article.isRead ? '● Mark Unread' : '○ Mark Read'}
      </button>
      <button
        onClick={() => {
          setContextMenu(null)
          void updateStatus(article.id, { isFavorite: !article.isFavorite })
        }}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white"
      >
        {article.isFavorite ? '★ Unfavorite' : '★ Favorite'}
      </button>
      <button
        onClick={() => {
          setContextMenu(null)
          void updateStatus(article.id, { isArchived: !article.isArchived })
        }}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white"
      >
        {article.isArchived ? '⇤ Unarchive' : '⇥ Archive'}
      </button>
      {article.extractionStatus === 'failed' && (
        <button
          onClick={() => {
            setContextMenu(null)
            void retryExtraction(article.id)
          }}
          className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white"
        >
          ↻ Retry
        </button>
      )}
      <button
        onClick={handleDelete}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-rose-600 hover:bg-rose-600 hover:text-white"
      >
        🗑 Delete
      </button>
    </div>
  )

  if (view === 'list') {
    return (
      <div
        className="relative flex items-center gap-4 rounded-lg border border-slate-200 bg-white px-4 py-2.5 shadow-sm dark:border-slate-700 dark:bg-slate-800"
        onContextMenu={(event) => {
          event.preventDefault()
          setContextMenu({ x: event.clientX, y: event.clientY })
        }}
      >
        <div
          className={`min-w-0 flex-1 ${canOpen ? 'cursor-pointer' : ''}`}
          onClick={() => canOpen && onOpen(article.id)}
        >
          <div className="flex items-center gap-2">
            <h4 className="truncate text-sm font-semibold text-slate-800 dark:text-slate-100">
              {article.title ?? article.url}
            </h4>
            {article.extractionStatus === 'pending' && (
              <span className="flex-shrink-0 text-[10px] text-indigo-500">Saving…</span>
            )}
            {article.extractionStatus === 'failed' && (
              <span className="flex-shrink-0 text-[10px] text-rose-500">Failed</span>
            )}
          </div>
          <p className="truncate text-xs text-slate-700 dark:text-slate-400">
            {article.sourceDomain}
            {article.author && ` • ${article.author}`}
          </p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-3 text-xs text-slate-800 dark:text-slate-400">
          <button
            onClick={() => updateStatus(article.id, { isRead: !article.isRead })}
            className={
              article.isRead
                ? 'cursor-pointer font-medium text-emerald-600'
                : 'cursor-pointer hover:text-indigo-600'
            }
          >
            {article.isRead ? 'Read' : 'Mark read'}
          </button>
          <button
            onClick={() => updateStatus(article.id, { isFavorite: !article.isFavorite })}
            className={
              article.isFavorite
                ? 'cursor-pointer font-medium text-amber-500'
                : 'cursor-pointer hover:text-indigo-600'
            }
          >
            ★ Favorite
          </button>
          <button
            onClick={() => updateStatus(article.id, { isArchived: !article.isArchived })}
            className="cursor-pointer hover:text-indigo-600"
          >
            {article.isArchived ? 'Unarchive' : 'Archive'}
          </button>
          {article.extractionStatus === 'failed' && (
            <button
              onClick={() => retryExtraction(article.id)}
              className="cursor-pointer font-medium text-indigo-600 hover:text-indigo-800"
            >
              Retry
            </button>
          )}
          <button onClick={handleDelete} className="cursor-pointer text-rose-500 hover:text-rose-700">
            Delete
          </button>
        </div>

        {contextMenuEl}
      </div>
    )
  }

  return (
    <div
      className="relative flex flex-col rounded-xl border border-slate-200 bg-white shadow-sm dark:border-slate-700 dark:bg-slate-800"
      onContextMenu={(event) => {
        event.preventDefault()
        setContextMenu({ x: event.clientX, y: event.clientY })
      }}
    >
      <div
        className={`flex-1 p-4 ${canOpen ? 'cursor-pointer' : ''}`}
        onClick={() => canOpen && onOpen(article.id)}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-xs text-slate-700">{article.sourceDomain}</span>
          <div className="flex items-center gap-2">
            {article.extractionStatus === 'pending' && (
              <span className="text-[10px] text-indigo-500">Saving…</span>
            )}
            {article.extractionStatus === 'failed' && (
              <span className="text-[10px] text-rose-500">Failed</span>
            )}
            {article.author && (
              <span className="text-xs text-slate-800 dark:text-slate-400">
                {article.author}
              </span>
            )}
          </div>
        </div>
        <h4 className="line-clamp-2 text-sm font-semibold text-slate-800 dark:text-slate-100">
          {article.title ?? article.url}
        </h4>
        {article.extractionStatus === 'failed' && article.extractionError && (
          <p className="mt-2 text-xs text-rose-500">{article.extractionError}</p>
        )}
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 px-4 py-2 text-xs text-slate-800 dark:border-slate-700 dark:text-slate-400">
        <div className="flex gap-3">
          <button
            onClick={() => updateStatus(article.id, { isRead: !article.isRead })}
            className={
              article.isRead
                ? 'cursor-pointer font-medium text-emerald-600'
                : 'cursor-pointer hover:text-indigo-600'
            }
          >
            {article.isRead ? 'Read' : 'Mark read'}
          </button>
          <button
            onClick={() => updateStatus(article.id, { isFavorite: !article.isFavorite })}
            className={
              article.isFavorite
                ? 'cursor-pointer font-medium text-amber-500'
                : 'cursor-pointer hover:text-indigo-600'
            }
          >
            ★ Favorite
          </button>
          <button
            onClick={() => updateStatus(article.id, { isArchived: !article.isArchived })}
            className="cursor-pointer hover:text-indigo-600"
          >
            {article.isArchived ? 'Unarchive' : 'Archive'}
          </button>
        </div>
        <div className="flex items-center gap-3">
          {article.extractionStatus === 'failed' && (
            <button
              onClick={() => retryExtraction(article.id)}
              className="cursor-pointer font-medium text-indigo-600 hover:text-indigo-800"
            >
              Retry
            </button>
          )}
          <button onClick={handleDelete} className="cursor-pointer text-rose-500 hover:text-rose-700">
            Delete
          </button>
        </div>
      </div>

      {contextMenuEl}
    </div>
  )
}
