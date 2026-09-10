import { useState, type KeyboardEvent } from 'react'
import type { ArticleStatusFilter, Category } from '@shared/types'
import { useAppStore } from '../store/appStore'
import { useFeedStore } from '../store/feedStore'
import { toErrorMessage } from '../lib/errorMessage'

const STATUS_FILTERS: { label: string; value: ArticleStatusFilter }[] = [
  { label: 'All Articles', value: 'all' },
  { label: 'Unread', value: 'unread' },
  { label: 'Favorites', value: 'favorite' },
  { label: 'Archive', value: 'archived' }
]

export function Sidebar({
  onAddClick,
  onOpenFeeds,
  onOpenSettings,
  onOpenAnalytics
}: {
  onAddClick: () => void
  onOpenFeeds: () => void
  onOpenSettings: () => void
  onOpenAnalytics: () => void
}): React.JSX.Element {
  const { categories, filter, setFilter, createCategory, renameCategory, deleteCategory } =
    useAppStore()
  const totalUnread = useFeedStore((state) =>
    state.feeds.reduce((sum, feed) => sum + feed.unreadCount, 0)
  )
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [addError, setAddError] = useState<string | null>(null)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [renameError, setRenameError] = useState<string | null>(null)

  function closeAdd(): void {
    setAdding(false)
    setNewName('')
    setAddError(null)
  }

  async function submitAdd(): Promise<void> {
    const name = newName.trim()
    if (!name) {
      closeAdd()
      return
    }
    try {
      await createCategory(name)
      closeAdd()
    } catch (error) {
      setAddError(toErrorMessage(error, 'Could not add category'))
    }
  }

  function closeRename(): void {
    setRenamingId(null)
    setRenameValue('')
    setRenameError(null)
  }

  async function submitRename(id: string): Promise<void> {
    const name = renameValue.trim()
    if (!name) {
      closeRename()
      return
    }
    try {
      await renameCategory(id, name)
      closeRename()
    } catch (error) {
      setRenameError(toErrorMessage(error, 'Could not rename category'))
    }
  }

  function handleKey(
    event: KeyboardEvent<HTMLInputElement>,
    onSubmit: () => void,
    onCancel: () => void
  ): void {
    if (event.key === 'Enter') onSubmit()
    if (event.key === 'Escape') onCancel()
  }

  function handleDeleteCategory(category: Category): void {
    if (window.confirm(`Delete "${category.name}"? Its articles will move to Default.`)) {
      void deleteCategory(category.id)
    }
  }

  return (
    <aside className="flex w-[180px] flex-shrink-0 flex-col border-r border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-950">
      <div className="border-b border-slate-200 p-3 dark:border-slate-800">
        <button
          onClick={onAddClick}
          className="w-full cursor-pointer bg-indigo-600 px-3 py-2 text-xs font-medium text-white shadow-sm hover:bg-indigo-500"
        >
          + Save New Article
        </button>
      </div>

      <div className="border-b border-slate-200 py-1.5 pl-3 pr-3 dark:border-slate-800">
        <button
          onClick={onOpenFeeds}
          className="flex w-full cursor-pointer items-center gap-2 py-1.5 text-left text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
        >
          <span>📡</span>
          <span className="flex-1">Feeds</span>
          {totalUnread > 0 && (
            <span className="rounded-full bg-indigo-600 px-1.5 py-0.5 text-[10px] font-bold text-white">
              {totalUnread}
            </span>
          )}
        </button>
      </div>

      <div className="py-3 pl-3 pr-3">
        <div className="px-0 py-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          Library
        </div>
        <div className="flex flex-col gap-0.5">
          {STATUS_FILTERS.map((item) => (
            <button
              key={item.value}
              onClick={() => setFilter({ ...filter, status: item.value, categoryId: undefined })}
              className={`flex w-full cursor-pointer items-center justify-between py-1.5 text-left text-xs ${
                filter.status === item.value && !filter.categoryId
                  ? 'bg-indigo-50 font-medium text-indigo-700 dark:bg-indigo-950 dark:text-indigo-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto pl-3 pt-2">
        <div className="flex items-center justify-between py-1 pr-3 text-[11px] font-bold uppercase tracking-wider text-slate-400">
          <span>Categories</span>
          <button
            onClick={() => setAdding(true)}
            className="cursor-pointer normal-case text-indigo-500 hover:text-indigo-700"
          >
            + Add
          </button>
        </div>
        <div className="flex flex-col gap-1.5 pr-3 text-xs">
          {adding && (
            <div>
              <input
                autoFocus
                value={newName}
                onChange={(event) => {
                  setNewName(event.target.value)
                  if (addError) setAddError(null)
                }}
                onKeyDown={(event) => handleKey(event, submitAdd, closeAdd)}
                onBlur={closeAdd}
                placeholder="Category name"
                className="w-full rounded border border-indigo-300 px-2.5 py-1.5 text-xs focus:outline-none"
              />
              {addError && <p className="mt-1 text-[11px] text-rose-600">{addError}</p>}
            </div>
          )}
          {categories.map((category) =>
            renamingId === category.id ? (
              <div key={category.id}>
                <input
                  autoFocus
                  value={renameValue}
                  onChange={(event) => {
                    setRenameValue(event.target.value)
                    if (renameError) setRenameError(null)
                  }}
                  onKeyDown={(event) =>
                    handleKey(event, () => submitRename(category.id), closeRename)
                  }
                  onBlur={closeRename}
                  className="w-full rounded border border-indigo-300 px-2.5 py-1.5 text-xs focus:outline-none"
                />
                {renameError && <p className="mt-1 text-[11px] text-rose-600">{renameError}</p>}
              </div>
            ) : (
              <div
                key={category.id}
                className={`group flex items-center justify-between py-1.5 ${
                  filter.categoryId === category.id
                    ? 'bg-slate-200 font-medium text-indigo-700 dark:bg-slate-800 dark:text-indigo-300'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
                }`}
              >
                <button
                  onClick={() => setFilter({ ...filter, status: 'all', categoryId: category.id })}
                  className="flex-1 cursor-pointer truncate text-left"
                >
                  {category.name}
                </button>
                {!category.isDefault && (
                  <span className="hidden items-center gap-3 group-hover:flex">
                    <button
                      title="Rename"
                      onClick={() => {
                        setRenamingId(category.id)
                        setRenameValue(category.name)
                      }}
                      className="cursor-pointer font-bold text-slate-400 hover:text-indigo-600"
                    >
                      ✎
                    </button>
                    <button
                      title="Delete"
                      onClick={() => handleDeleteCategory(category)}
                      className="cursor-pointer font-bold text-slate-400 hover:text-rose-600"
                    >
                      ✕
                    </button>
                  </span>
                )}
              </div>
            )
          )}
        </div>
      </div>

      <div className="flex items-center gap-1 border-t border-slate-200 px-3 py-1.5 dark:border-slate-800">
        <button
          onClick={onOpenSettings}
          className="flex flex-1 cursor-pointer items-center gap-2 py-1.5 text-left text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <span>⚙️</span>
          <span>Settings</span>
        </button>
        <button
          onClick={onOpenAnalytics}
          className="flex flex-1 cursor-pointer items-center justify-end gap-2 py-1.5 text-right text-xs text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          <span>Analytics</span>
          <span>📊</span>
        </button>
      </div>
    </aside>
  )
}
