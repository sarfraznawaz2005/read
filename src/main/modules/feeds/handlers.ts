import { runExtraction } from '../articles/handlers'
import { insertPendingArticle } from '../articles/repository'
import { getDefaultCategoryId } from '../categories/repository'
import { fetchFeed } from './fetch'
import { exportOpml, importOpml } from './opml'
import { applyFeedLimits, refreshFeedById, scanAllFeeds } from './scanService'
import {
  deleteFeed,
  deleteFeeds,
  getFeedById,
  getFeedByUrl,
  getFeedItemById,
  insertFeed,
  listAllFeedItems,
  listFeedItems,
  listFeeds,
  markAllFeedItemsRead,
  markFeedItemRead,
  markFeedItemSaved,
  markFeedItemUnread,
  renameFeed,
  upsertFeedItems
} from './repository'
import type { Article, Feed, FeedItem, FeedScanResult } from '@shared/types'

export const feedHandlers = {
  'feed:add': async (_event: unknown, feedUrl: string): Promise<Feed> => {
    const existing = getFeedByUrl(feedUrl)
    if (existing) return existing
    const fetched = await fetchFeed(feedUrl)
    const feed = insertFeed(fetched.title, feedUrl, fetched.siteUrl)
    upsertFeedItems(feed.id, applyFeedLimits(fetched.items))
    return getFeedById(feed.id)!
  },
  'feed:list': (): Feed[] => listFeeds(),
  'feed:listItems': (_event: unknown, feedId: string): FeedItem[] => listFeedItems(feedId),
  'feed:listAllItems': (): FeedItem[] => listAllFeedItems(),
  'feed:markItemRead': (_event: unknown, feedItemId: string): FeedItem =>
    markFeedItemRead(feedItemId),
  'feed:markItemUnread': (_event: unknown, feedItemId: string): FeedItem =>
    markFeedItemUnread(feedItemId),
  'feed:markAllRead': (_event: unknown, feedId?: string): void => markAllFeedItemsRead(feedId),
  'feed:refresh': async (_event: unknown, feedId: string): Promise<number> =>
    refreshFeedById(feedId),
  'feed:refreshAll': async (): Promise<FeedScanResult> => scanAllFeeds('manual'),
  'feed:delete': (_event: unknown, feedId: string): void => deleteFeed(feedId),
  'feed:deleteMany': (_event: unknown, feedIds: string[]): void => deleteFeeds(feedIds),
  'feed:rename': (_event: unknown, feedId: string, title: string): Feed =>
    renameFeed(feedId, title),
  'feed:saveItemToLibrary': async (
    _event: unknown,
    feedItemId: string,
    categoryId?: string
  ): Promise<Article> => {
    const item = getFeedItemById(feedItemId)
    if (!item) throw new Error(`Feed item ${feedItemId} not found`)
    const pending = insertPendingArticle(item.link, categoryId ?? getDefaultCategoryId())
    const article = await runExtraction(pending.id, item.link)
    markFeedItemSaved(feedItemId, article.id)
    return article
  },
  'opml:import': async (): Promise<{ added: number; skipped: number } | null> => importOpml(),
  'opml:export': async (): Promise<string | null> => exportOpml()
}
