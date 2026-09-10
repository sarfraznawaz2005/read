import { useState, type FormEvent } from 'react'
import { useAppStore } from '../store/appStore'

export function AddArticleDialog({ onClose }: { onClose: () => void }): React.JSX.Element {
  const { categories, addArticle, addingArticle } = useAppStore()
  const [url, setUrl] = useState('')
  const [categoryId, setCategoryId] = useState('')

  const handleSubmit = async (event: FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!url.trim()) return
    await addArticle(url.trim(), categoryId || undefined)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl dark:bg-slate-800"
      >
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-100">
          Save New Article
        </h3>

        <div className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Article URL
            </label>
            <input
              autoFocus
              type="url"
              required
              placeholder="https://example.com/article"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            />
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-slate-600 dark:text-slate-300">
              Category
            </label>
            <select
              value={categoryId}
              onChange={(event) => setCategoryId(event.target.value)}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            >
              <option value="">Default category</option>
              {categories
                .filter((category) => !category.isDefault)
                .map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
            </select>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-700"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={addingArticle}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-500 disabled:opacity-50"
          >
            {addingArticle ? 'Saving…' : 'Save'}
          </button>
        </div>
      </form>
    </div>
  )
}
