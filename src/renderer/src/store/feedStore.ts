import { create } from 'zustand'
import type { Article, Feed, FeedItem } from '@shared/types'

interface FeedState {
  feeds: Feed[]
  feedItems: FeedItem[]
  selectedFeedId: string | null
  loadingFeeds: boolean
  loadingItems: boolean
  error: string | null
  loadFeeds: () => Promise<void>
  selectFeed: (feedId: string | null) => Promise<void>
  addFeed: (feedUrl: string) => Promise<void>
  deleteFeed: (feedId: string) => Promise<void>
  deleteFeeds: (feedIds: string[]) => Promise<void>
  renameFeed: (feedId: string, title: string) => Promise<void>
  refreshFeed: (feedId: string) => Promise<void>
  refreshAllFeeds: () => Promise<void>
  markItemRead: (feedItemId: string) => Promise<void>
  markItemUnread: (feedItemId: string) => Promise<void>
  markAllRead: (feedId?: string) => Promise<void>
  saveItemToLibrary: (feedItemId: string, categoryId?: string) => Promise<Article>
  importOpml: () => Promise<{ added: number; skipped: number } | null>
  exportOpml: () => Promise<string | null>
}

async function loadItemsFor(feedId: string | null): Promise<FeedItem[]> {
  return feedId ? window.api.feeds.listItems(feedId) : window.api.feeds.listAllItems()
}

export const useFeedStore = create<FeedState>((set, get) => ({
  feeds: [],
  feedItems: [],
  selectedFeedId: null,
  loadingFeeds: false,
  loadingItems: false,
  error: null,

  loadFeeds: async () => {
    set({ loadingFeeds: true, error: null })
    try {
      const feeds = await window.api.feeds.list()
      set({ feeds, loadingFeeds: false })
    } catch (error) {
      set({
        loadingFeeds: false,
        error: error instanceof Error ? error.message : 'Failed to load feeds'
      })
    }
  },

  selectFeed: async (feedId) => {
    set({ selectedFeedId: feedId, feedItems: [], loadingItems: true, error: null })
    try {
      const feedItems = await loadItemsFor(feedId)
      set({ feedItems, loadingItems: false })
    } catch (error) {
      set({
        loadingItems: false,
        error: error instanceof Error ? error.message : 'Failed to load feed items'
      })
    }
  },

  addFeed: async (feedUrl) => {
    set({ error: null })
    try {
      await window.api.feeds.add(feedUrl)
      await get().loadFeeds()
    } catch (error) {
      set({ error: error instanceof Error ? error.message : 'Failed to add feed' })
    }
  },

  deleteFeed: async (feedId) => {
    await window.api.feeds.delete(feedId)
    if (get().selectedFeedId === feedId) await get().selectFeed(null)
    await get().loadFeeds()
  },

  deleteFeeds: async (feedIds) => {
    await window.api.feeds.deleteMany(feedIds)
    const selected = get().selectedFeedId
    if (selected && feedIds.includes(selected)) {
      await get().selectFeed(null)
    }
    await get().loadFeeds()
  },

  renameFeed: async (feedId, title) => {
    await window.api.feeds.rename(feedId, title)
    await get().loadFeeds()
  },

  refreshFeed: async (feedId) => {
    await window.api.feeds.refresh(feedId)
    await get().loadFeeds()
    if (get().selectedFeedId === feedId) await get().selectFeed(feedId)
  },

  refreshAllFeeds: async () => {
    await window.api.feeds.refreshAll()
    await get().loadFeeds()
    await get().selectFeed(get().selectedFeedId)
  },

  markItemRead: async (feedItemId) => {
    const updated = await window.api.feeds.markItemRead(feedItemId)
    set({ feedItems: get().feedItems.map((item) => (item.id === feedItemId ? updated : item)) })
    await get().loadFeeds()
  },

  markItemUnread: async (feedItemId) => {
    const updated = await window.api.feeds.markItemUnread(feedItemId)
    set({ feedItems: get().feedItems.map((item) => (item.id === feedItemId ? updated : item)) })
    await get().loadFeeds()
  },

  markAllRead: async (feedId) => {
    await window.api.feeds.markAllRead(feedId)
    await get().loadFeeds()
    await get().selectFeed(get().selectedFeedId)
  },

  saveItemToLibrary: async (feedItemId, categoryId) => {
    const article = await window.api.feeds.saveItemToLibrary(feedItemId, categoryId)
    set({
      feedItems: get().feedItems.map((item) =>
        item.id === feedItemId ? { ...item, savedArticleId: article.id } : item
      )
    })
    return article
  },

  importOpml: async () => {
    const result = await window.api.opml.import()
    if (result) await get().loadFeeds()
    return result
  },

  exportOpml: async () => window.api.opml.export()
}))

// Automatic scans happen on a timer in the main process, so the UI must pick up
// new items / unread counts on its own instead of waiting for a user action.
window.api.feeds.onScanFinished(() => {
  void useFeedStore.getState().loadFeeds()
  const { selectedFeedId } = useFeedStore.getState()
  void useFeedStore.getState().selectFeed(selectedFeedId)
})
