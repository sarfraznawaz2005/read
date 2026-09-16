import { useEffect, useRef, useState } from 'react'
import {
  ArrowLeft,
  ArrowUp,
  ArrowDown,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Globe,
  Highlighter,
  RotateCw,
  X
} from 'lucide-react'
import type { Article } from '@shared/types'
import { useAppStore } from '../store/appStore'
import { useEmbeddedPage } from '../hooks/useEmbeddedPage'
import { HighlightableContent, type HighlightableContentHandle } from './HighlightableContent'

function isHttpUrl(url: string): boolean {
  return /^https?:\/\//i.test(url)
}

const FONT_FAMILIES = [
  { label: 'Georgia', value: 'Georgia, Cambria, "Times New Roman", serif' },
  { label: 'Cambria', value: 'Cambria, Georgia, "Times New Roman", serif' },
  { label: 'Calibri', value: 'Calibri, "Segoe UI", sans-serif' },
  { label: 'Segoe UI', value: '"Segoe UI", Calibri, sans-serif' },
  { label: 'Verdana', value: 'Verdana, Geneva, sans-serif' },
  { label: 'Consolas', value: 'Consolas, "Cascadia Code", monospace' }
]

const BACKGROUNDS = [
  { label: 'Paper White', bg: '#ffffff', text: '#1e293b', dark: false },
  { label: 'Light Gray', bg: '#f3f4f6', text: '#1e293b', dark: false },
  { label: 'Sepia', bg: '#f8f1e3', text: '#3c2f1f', dark: false },
  { label: 'Slate Dark', bg: '#1e293b', text: '#f1f5f9', dark: true },
  { label: 'OLED Black', bg: '#000000', text: '#e2e8f0', dark: true }
]

const MIN_FONT_SIZE = 14
const MAX_FONT_SIZE = 28

const FONT_FAMILY_KEY = 'read:reader:fontFamily'
const FONT_SIZE_KEY = 'read:reader:fontSize'
const BACKGROUND_KEY = 'read:reader:background'

function loadStoredFontFamily(): string {
  const stored = localStorage.getItem(FONT_FAMILY_KEY)
  return FONT_FAMILIES.some((f) => f.value === stored) ? (stored as string) : FONT_FAMILIES[0].value
}

function loadStoredFontSize(): number {
  const stored = Number(localStorage.getItem(FONT_SIZE_KEY))
  return stored >= MIN_FONT_SIZE && stored <= MAX_FONT_SIZE ? stored : 18
}

function loadStoredBackground(): (typeof BACKGROUNDS)[number] {
  const stored = localStorage.getItem(BACKGROUND_KEY)
  return BACKGROUNDS.find((b) => b.label === stored) ?? BACKGROUNDS[0]
}

export function ReaderView({
  article,
  onBack
}: {
  article: Article
  onBack: () => void
}): React.JSX.Element {
  const { retryExtraction, markOpened, highlights, categories, updateStatus } = useAppStore()
  const [fontFamily, setFontFamilyState] = useState(loadStoredFontFamily)
  const [fontSize, setFontSizeState] = useState(loadStoredFontSize)
  const [background, setBackgroundState] = useState(loadStoredBackground)

  function setFontFamily(value: string): void {
    setFontFamilyState(value)
    localStorage.setItem(FONT_FAMILY_KEY, value)
  }

  function setFontSize(updater: (size: number) => number): void {
    setFontSizeState((size) => {
      const next = updater(size)
      localStorage.setItem(FONT_SIZE_KEY, String(next))
      return next
    })
  }

  function setBackground(option: (typeof BACKGROUNDS)[number]): void {
    setBackgroundState(option)
    localStorage.setItem(BACKGROUND_KEY, option.label)
  }
  const contentRef = useRef<HighlightableContentHandle>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [findOpen, setFindOpen] = useState(false)
  const [findQuery, setFindQuery] = useState('')
  const [findCount, setFindCount] = useState(0)
  const [progress, setProgress] = useState(0)
  const [showOriginal, setShowOriginal] = useState(false)
  const canShowOriginal = isHttpUrl(article.url)
  const { anchorRef } = useEmbeddedPage(showOriginal && canShowOriginal ? article.url : null)

  useEffect(() => {
    void markOpened(article.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [article.id])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent): void => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'f' && !showOriginal) {
        event.preventDefault()
        setFindOpen(true)
      } else if (event.key === 'Escape' && findOpen) {
        closeFind()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [findOpen, showOriginal])

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

  function scrollToTop(): void {
    scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function scrollToBottom(): void {
    const el = scrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }

  const content = (
    <article
      className={`prose mx-auto w-full max-w-4xl ${background.dark ? 'prose-invert' : ''}`}
      style={{ fontFamily, fontSize: `${fontSize}px` }}
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
            <ArrowLeft className="h-3.5 w-3.5" />
            Library
          </button>
          <button
            onClick={() => retryExtraction(article.id)}
            title="Refresh / Re-extract content"
            className="inline-flex items-center justify-center rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <RotateCw className="h-3.5 w-3.5" />
          </button>
          <button
            onClick={() => void window.api.browser.openExternal(article.url)}
            title="Open original in browser"
            className="inline-flex items-center justify-center rounded-lg px-2 py-1.5 text-xs text-slate-500 hover:bg-slate-200 dark:text-slate-400 dark:hover:bg-slate-800"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </button>

          {canShowOriginal && (
            <button
              onClick={() => {
                setShowOriginal((value) => !value)
                closeFind()
              }}
              title="Load the original website instead of the simplified reader view"
              aria-pressed={showOriginal}
              className={`flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs font-medium ${
                showOriginal
                  ? 'border-indigo-300 bg-indigo-50 text-indigo-700 dark:border-indigo-800 dark:bg-indigo-950 dark:text-indigo-300'
                  : 'border-slate-300 bg-white text-slate-500 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400'
              }`}
            >
              <Globe className="h-3.5 w-3.5" />
              Original
              <span
                className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${
                  showOriginal ? 'bg-indigo-600' : 'bg-slate-300 dark:bg-slate-600'
                }`}
              >
                <span
                  className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${
                    showOriginal ? 'translate-x-3.5' : 'translate-x-0.5'
                  }`}
                />
              </span>
            </button>
          )}

          {!showOriginal &&
            (findOpen ? (
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
                {findQuery && (
                  <span className="text-[10px] text-slate-400">{findCount} matches</span>
                )}
                <button
                  onClick={() => contentRef.current?.findPrev()}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <ChevronUp className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => contentRef.current?.findNext()}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <ChevronDown className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={closeFind}
                  className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <X className="h-3.5 w-3.5" />
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
            ))}

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
            <span className="flex items-center gap-1 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-xs font-medium text-amber-700">
              <Highlighter className="h-3.5 w-3.5" />
              {highlights.length} {highlights.length === 1 ? 'Highlight' : 'Highlights'}
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
            disabled={showOriginal}
            onChange={(event) => setFontFamily(event.target.value)}
            title={showOriginal ? 'Not available for the original website' : undefined}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            {FONT_FAMILIES.map((font) => (
              <option key={font.label} value={font.value}>
                {font.label}
              </option>
            ))}
          </select>

          <div
            className={`flex items-center rounded-md border border-slate-300 bg-white dark:border-slate-700 dark:bg-slate-800 ${showOriginal ? 'opacity-40' : ''}`}
            title={showOriginal ? 'Not available for the original website' : undefined}
          >
            <button
              disabled={showOriginal}
              onClick={() => setFontSize((s) => Math.max(MIN_FONT_SIZE, s - 2))}
              className="rounded-l-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-700"
            >
              A-
            </button>
            <span className="px-1 font-mono text-[11px] text-slate-500 dark:text-slate-400">
              {fontSize}px
            </span>
            <button
              disabled={showOriginal}
              onClick={() => setFontSize((s) => Math.min(MAX_FONT_SIZE, s + 2))}
              className="rounded-r-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:hover:bg-transparent dark:text-slate-300 dark:hover:bg-slate-700"
            >
              A+
            </button>
          </div>

          <div
            className={`flex items-center gap-1 rounded-md border border-slate-300 bg-white p-1 dark:border-slate-700 dark:bg-slate-800 ${showOriginal ? 'opacity-40' : ''}`}
            title={showOriginal ? 'Not available for the original website' : undefined}
          >
            {BACKGROUNDS.map((bgOption) => (
              <button
                key={bgOption.label}
                title={bgOption.label}
                disabled={showOriginal}
                onClick={() => setBackground(bgOption)}
                className={`h-4 w-4 rounded-full border disabled:cursor-not-allowed ${
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

      {!showOriginal && (
        <div className="h-0.5 w-full flex-shrink-0 bg-slate-200 dark:bg-slate-800">
          <div
            className="h-full bg-indigo-600 transition-[width]"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      )}

      <div className="relative flex-1 overflow-hidden">
        {showOriginal && canShowOriginal ? (
          <div ref={anchorRef} className="h-full w-full" />
        ) : (
          <div
            ref={scrollRef}
            className="h-full overflow-y-auto p-6 md:p-12"
            onScroll={handleScroll}
            style={{ backgroundColor: background.bg, color: background.text }}
          >
            {content}
          </div>
        )}

        {!showOriginal && (
          <div className="absolute bottom-24 right-4 flex flex-col gap-2">
            {progress > 0.02 && (
              <button
                onClick={scrollToTop}
                title="Scroll to top"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 shadow hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <ArrowUp className="h-4 w-4" />
              </button>
            )}
            {progress < 0.98 && (
              <button
                onClick={scrollToBottom}
                title="Scroll to bottom"
                className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-600 shadow hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              >
                <ArrowDown className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
