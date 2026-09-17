import { useEffect, useRef, useState } from 'react'
import { LayoutGrid, List, Rows3 } from 'lucide-react'
import type { ArticleSort } from '@shared/types'
import { useAppStore } from '../store/appStore'

const SORT_OPTIONS: { label: string; value: ArticleSort }[] = [
  { label: 'Date Saved (Newest)', value: 'date_desc' },
  { label: 'Date Saved (Oldest)', value: 'date_asc' },
  { label: 'Title (A-Z)', value: 'title_asc' },
  { label: 'Read Status', value: 'read_status' }
]

export function LibraryToolbar({
  viewMode,
  onChangeViewMode
}: {
  viewMode: 'card' | 'list' | 'compact'
  onChangeViewMode: (mode: 'card' | 'list' | 'compact') => void
}): React.JSX.Element {
  const { filter, setFilter } = useAppStore()
  const [query, setQuery] = useState(filter.query ?? '')
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined)

  useEffect(() => {
    clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (query !== (filter.query ?? '')) {
        setFilter({ ...filter, query: query || undefined })
      }
    }, 250)
    return () => clearTimeout(debounceRef.current)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query])

  return (
    <div className="mb-4 flex items-center gap-3">
      <div className="relative max-w-md flex-1">
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search articles, authors..."
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-700 focus:border-indigo-500 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
        />
      </div>
      <div className="flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
        <span className="text-slate-400">Sort:</span>
        <select
          value={filter.sort ?? 'date_desc'}
          onChange={(event) => setFilter({ ...filter, sort: event.target.value as ArticleSort })}
          className="border-none bg-transparent text-xs font-medium text-slate-700 focus:outline-none dark:text-slate-200"
        >
          {SORT_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>
      <div className="ml-auto flex items-center gap-0.5 rounded-lg border border-slate-300 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-800">
        <button
          title="Card view"
          onClick={() => onChangeViewMode('card')}
          className={`inline-flex items-center justify-center rounded-md px-2 py-1 text-xs ${
            viewMode === 'card'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
          }`}
        >
          <LayoutGrid className="h-3.5 w-3.5" />
        </button>
        <button
          title="List view"
          onClick={() => onChangeViewMode('list')}
          className={`inline-flex items-center justify-center rounded-md px-2 py-1 text-xs ${
            viewMode === 'list'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
          }`}
        >
          <List className="h-3.5 w-3.5" />
        </button>
        <button
          title="Compact view (titles only)"
          onClick={() => onChangeViewMode('compact')}
          className={`inline-flex items-center justify-center rounded-md px-2 py-1 text-xs ${
            viewMode === 'compact'
              ? 'bg-indigo-600 text-white'
              : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-700'
          }`}
        >
          <Rows3 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  )
}
