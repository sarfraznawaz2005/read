import { useEffect, useRef, useState } from 'react'
import type { Article } from '@shared/types'
import { useAppStore } from '../store/appStore'
import { HighlightableContent, type HighlightableContentHandle } from './HighlightableContent'

const FONT_FAMILIES = [
  { label: 'Serif', value: 'Georgia, "Times New Roman", serif' },
  { label: 'Sans', value: 'Inter, system-ui, sans-serif' },
  { label: 'Monospace', value: '"Fira Code", Consolas, monospace' }
]

const BACKGROUNDS = [
  { label: 'Paper White', bg: '#ffffff', text: '#1e293b', dark: false },
  { label: 'Sepia', bg: '#f8f1e3', text: '#3c2f1f', dark: false },
  { label: 'Slate Dark', bg: '#1e293b', text: '#f1f5f9', dark: true },
  { label: 'OLED Black', bg: '#000000', text: '#e2e8f0', dark: true }
]

const MIN_FONT_SIZE = 14
const MAX_FONT_SIZE = 28

export function ReaderView({
  article,
  onBack
}: {
  article: Article
  onBack: () => void
}): React.JSX.Element {
  const { retryExtraction, markOpened, highlights, categories, updateStatus } = useAppStore()
  const [fontFamily, setFontFamily] = useState(FONT_FAMILIES[0].value)
  const [fontSize, setFontSize] = useState(18)
  const [background, setBackground] = useState(BACKGROUNDS[0])
  const contentRef = useRef<HighlightableContentHandle>(null)
  const [findOpen, setFindOpen] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [findCount, setFindCount] = useState(0)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    void markOpened(article.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.id])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'f') {
        event.preventDefault()
        setFindOpen(true)
      } else if (event.key === 'Escape' && findOpen) {
        closeFind()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [findOpen])

  function handleScroll(event: React.UIEvent<HTMLDivElement>): void {
    const el = event.currentTarget
    const max = el.scrollHeight - el.clientHeight
    setProgress(max > 0 ? Math.min(1, Math.max(0, el.scrollTop / max)) : 0)
  }

  const wordCount = article.contentText
    ? article.contentText.trim().split(/\s+/).filter(Boolean).length
    : 0
  const readingMinutes = wordCount > 0 ? Math.max(1, Math.round(wordCount / 200)) : null

  function runFind(query: string): void {
    setFindQuery(query)
    setFindCount(contentRef.current?.find(query) ?? 0)
  }

  function closeFind(): void {
    setFindOpen(false)
    setFindQuery('')
    setFindCount(0)
    contentRef.current?.clearFind()
  }

  const content = (
    <article
      className={`prose mx-auto w-full max-w-2xl ${background.dark ? 'prose-invert' : ''}`}
      style={{ fontFamily, fontSize: `${fontSize}px` }}
      onClick={(event) => {
        const link = (event.target as HTMLElement).closest('a')
        if (!link) return
        event.preventDefault()
        const href = link.getAttribute('href')
        if (href && !href.startsWith('#')) void window.api.browser.open(href)
      }}
    >
      <div className="not-prose mb-6 border-b pb-6" style={{ borderColor: `${background.text}33` }}>
        <h1 className="mb-3 text-3xl font-bold leading-tight">{article.title ?? article.url}</h1>
        <div className="flex flex-wrap items-center gap-2 text-sm opacity-70">
          {article.author && <span className="font-medium">{article.author}</span>}
          {article.author && <span>&bull;</span>}
          <span>{article.sourceDomain}</span>
          {readingMinutes && (
            <>
              <span>&bull;</span>
              <span>{readingMinutes} min read</span>
            </>
          )}
        </div>
      </div>
      {article.extractionStatus === 'ok' && article.contentHtml && (
        <HighlightableContent ref={contentRef} article={article} />
      )}
      {article.extractionStatus === 'failed' && (
        <div className="rounded-lg border border-rose-300 bg-rose-50 p-4 text-sm text-rose-700">
          <p className="font-medium">Could not load this article.</p>
          {article.extractionError && <p className="mt-1 opacity-80">{article.extractionError}</p>}
          <button
            onClick={() => retryExtraction(article.id)}
            className="mt-3 rounded-lg bg-rose-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-rose-500"
          >
            Retry
          </button>
        </div>
      )}
      {article.extractionStatus === 'pending' && <p className="opacity-70">Saving…</p>}
    </article>
  )

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden">
      <div className="flex h-12 flex-shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 dark:border-slate-800 dark:bg-slate-900">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs text-slate-600 hover:bg-slate-200 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            ← Library
          </button>
          <button
            onClick={() => retryExtraction(article.id)}
            title="Refresh / Re-extract content"
            className="rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            ↻
          </button>

          {findOpen ? (
            <div className="flex items-center gap-1.5 rounded-md border border-indigo-300 bg-white px-2 py-1 dark:border-indigo-700 dark:bg-slate-800">
              <input
                autoFocus
                value={findQuery}
                onChange={(event) => runFind(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== 'Enter') return
                  if (event.shiftKey) contentRef.current?.findPrev()
                  else contentRef.current?.findNext()
                }}
                placeholder="Find in article..."
                className="w-36 text-xs text-slate-700 focus:outline-none dark:bg-transparent dark:text-slate-200"
              />
              {findQuery && <span className="text-[10px] text-slate-400">{findCount} matches</span>}
              <button
                onClick={() => contentRef.current?.findPrev()}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                ↑
              </button>
              <button
                onClick={() => contentRef.current?.findNext()}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                ↓
              </button>
              <button
                onClick={closeFind}
                className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>
          ) : (
            <button
              onClick={() => setFindOpen(true)}
              className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-500 hover:border-slate-400 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400"
            >
              <span>Find in article...</span>
              <kbd className="rounded bg-slate-100 px-1 text-[10px] text-slate-400 dark:bg-slate-700">
                Ctrl+F
              </kbd>
            </button>
          )}

          <div className="flex items-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300">
            <select
              value={article.categoryId}
              onChange={(event) => updateStatus(article.id, { categoryId: event.target.value })}
              className="border-none bg-transparent text-xs font-medium text-indigo-700 focus:outline-none dark:text-indigo-300"
            >
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {highlights.length > 0 && (
            <span className="rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
              🖍️ {highlights.length} {highlights.length === 1 ? 'Highlight' : 'Highlights'}
              {highlights.some((h) => h.comment) && (
                <span className="ml-1 rounded bg-amber-200 px-1 text-[10px] text-amber-800">
                  {highlights.filter((h) => h.comment).length} note
                  {highlights.filter((h) => h.comment).length === 1 ? '' : 's'}
                </span>
              )}
            </span>
          )}
          <select
            value={fontFamily}
            onChange={(event) => setFontFamily(event.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {FONT_FAMILIES.map((font) => (
              <option key={font.label} value={font.value}>
                {font.label}
              </option>
            ))}
          </select>

          <div className="flex items-center rounded-md border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800">
            <button
              onClick={() => setFontSize((s) => Math.max(MIN_FONT_SIZE, s - 2))}
              className="rounded-l-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              A-
            </button>
            <span className="px-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
              {fontSize}px
            </span>
            <button
              onClick={() => setFontSize((s) => Math.min(MAX_FONT_SIZE, s + 2))}
              className="rounded-r-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
            >
              A+
            </button>
          </div>

          <div className="flex items-center gap-1 rounded-md border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-800">
            {BACKGROUNDS.map((bgOption) => (
              <button
                key={bgOption.label}
                title={bgOption.label}
                onClick={() => setBackground(bgOption)}
                className={`h-4 w-4 rounded-full border ${
                  background.label === bgOption.label
                    ? 'ring-2 ring-indigo-500'
                    : 'border-slate-300'
                }`}
                style={{ backgroundColor: bgOption.bg }}
              />
            ))}
          </div>

          <button
            onClick={() => updateStatus(article.id, { isRead: !article.isRead })}
            className={`rounded-md px-2.5 py-1 text-xs font-medium text-white ${
              article.isRead
                ? 'bg-slate-400 hover:bg-slate-500'
                : 'bg-indigo-600 hover:bg-indigo-500'
            }`}
          >
            {article.isRead ? 'Mark Unread' : 'Mark Read'}
          </button>
        </div>
      </div>

      <div className="h-0.5 w-full flex-shrink-0 bg-slate-200 dark:bg-slate-800">
        <div
          className="h-full bg-indigo-600 transition-[width]"
          style={{ width: `${progress * 100}%` }}
        />
      </div>

      <div
        className="flex-1 overflow-y-auto p-6 md:p-12"
        onScroll={handleScroll}
        style={{ backgroundColor: background.bg, color: background.text }}
      >
        {content}
      </div>
    </div>
  )
}
