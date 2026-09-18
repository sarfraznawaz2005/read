import { create } from 'zustand'
import { toErrorMessage } from '../lib/errorMessage'
import type {
  Article,
  ArticleCounts,
  ArticleListFilter,
  ArticleStatusPatch,
  Category,
  Highlight,
  HighlightColor,
  TextQuoteAnchor
} from '@shared/types'

export interface Toast {
  type: 'success' | 'error'
  message: string
}

interface AppState {
  categories: Category[]
  articles: Article[]
  counts: ArticleCounts
  filter: ArticleListFilter
  loading: boolean
  addingArticle: boolean
  toast: Toast | null
  highlights: Highlight[]
  loadCategories: () => Promise<void>
  loadArticles: () => Promise<void>
  loadCounts: () => Promise<void>
  setFilter: (filter: ArticleListFilter) => void
  clearToast: () => void
  createCategory: (name: string) => Promise<void>
  renameCategory: (id: string, name: string) => Promise<void>
  deleteCategory: (id: string) => Promise<void>
  addArticle: (url: string, categoryId?: string) => Promise<void>
  retryExtraction: (articleId: string) => Promise<void>
  updateStatus: (articleId: string, patch: ArticleStatusPatch) => Promise<void>
  deleteArticle: (articleId: string) => Promise<void>
  markOpened: (articleId: string) => Promise<void>
  loadHighlights: (articleId: string) => Promise<void>
  addHighlight: (
    articleId: string,
    anchor: TextQuoteAnchor,
    color: HighlightColor,
    selectedText: string
  ) => Promise<Highlight>
  updateHighlightColor: (id: string, color: HighlightColor) => Promise<void>
  deleteHighlight: (id: string) => Promise<void>
  upsertComment: (highlightId: string, text: string) => Promise<void>
  deleteComment: (highlightId: string) => Promise<void>
}

export const useAppStore = create<AppState>((set, get) => ({
  categories: [],
  articles: [],
  counts: { all: 0, unread: 0, favorite: 0, archived: 0, byCategory: {} },
  filter: { status: 'unread' },
  loading: false,
  addingArticle: false,
  toast: null,
  highlights: [],

  loadCategories: async () => {
    const categories = await window.api.categories.list()
    set({ categories })
  },

  loadArticles: async () => {
    set({ loading: true })
    try {
      const articles = await window.api.articles.list(get().filter)
      set({ articles, loading: false })
    } catch (error) {
      set({
        loading: false,
        toast: { type: 'error', message: toErrorMessage(error, 'Failed to load articles') }
      })
    }
    void get().loadCounts()
  },

  loadCounts: async () => {
    const counts = await window.api.articles.counts()
    set({ counts })
  },

  setFilter: (filter) => {
    set({ filter })
    void get().loadArticles()
  },

  clearToast: () => set({ toast: null }),

  createCategory: async (name) => {
    await window.api.categories.create(name)
    await get().loadCategories()
  },

  renameCategory: async (id, name) => {
    await window.api.categories.rename(id, name)
    await get().loadCategories()
  },

  deleteCategory: async (id) => {
    await window.api.categories.delete(id)
    await get().loadCategories()
    if (get().filter.categoryId === id) {
      get().setFilter({ status: 'all' })
    } else {
      await get().loadArticles()
    }
  },

  addArticle: async (url, categoryId) => {
    set({ addingArticle: true })
    try {
      await window.api.articles.add(url, categoryId)
      await get().loadArticles()
      set({ toast: { type: 'success', message: 'Article saved.' } })
    } catch (error) {
      const message = toErrorMessage(error, 'Failed to save article')
      set({ toast: { type: 'error', message } })
      throw new Error(message)
    } finally {
      set({ addingArticle: false })
    }
  },

  retryExtraction: async (articleId) => {
    await window.api.articles.retryExtraction(articleId)
    await get().loadArticles()
  },

  updateStatus: async (articleId, patch) => {
    await window.api.articles.updateStatus(articleId, patch)
    await get().loadArticles()
  },

  deleteArticle: async (articleId) => {
    await window.api.articles.delete(articleId)
    await get().loadArticles()
  },

  markOpened: async (articleId) => {
    const updated = await window.api.articles.markOpened(articleId)
    set({ articles: get().articles.map((a) => (a.id === articleId ? updated : a)) })
  },

  loadHighlights: async (articleId) => {
    const highlights = await window.api.highlights.listByArticle(articleId)
    set({ highlights })
  },

  addHighlight: async (articleId, anchor, color, selectedText) => {
    const highlight = await window.api.highlights.add(articleId, anchor, color, selectedText)
    set({ highlights: [...get().highlights, highlight] })
    return highlight
  },

  updateHighlightColor: async (id, color) => {
    const updated = await window.api.highlights.update(id, color)
    set({ highlights: get().highlights.map((h) => (h.id === id ? updated : h)) })
  },

  deleteHighlight: async (id) => {
    await window.api.highlights.delete(id)
    set({ highlights: get().highlights.filter((h) => h.id !== id) })
  },

  upsertComment: async (highlightId, text) => {
    const updated = await window.api.highlights.upsertComment(highlightId, text)
    set({ highlights: get().highlights.map((h) => (h.id === highlightId ? updated : h)) })
  },

  deleteComment: async (highlightId) => {
    const updated = await window.api.highlights.deleteComment(highlightId)
    set({ highlights: get().highlights.map((h) => (h.id === highlightId ? updated : h)) })
  }
}))
