import { randomUUID } from 'crypto'
import { getDb } from '../../db'
import type { Feed, FeedItem } from '@shared/types'

const FEED_SELECT = `
  SELECT f.*,
    (SELECT COUNT(*) FROM feed_items fi WHERE fi.feed_id = f.id) AS item_count,
    (SELECT COUNT(*) FROM feed_items fi WHERE fi.feed_id = f.id AND fi.is_read = 0) AS unread_count
  FROM feeds f
`

interface FeedRow {
  id: string
  title: string
  feed_url: string
  site_url: string | null
  added_at: string
  item_count: number
  unread_count: number
  last_checked_at: string | null
  last_error: string | null
  failure_count: number
}

interface FeedItemRow {
  id: string
  feed_id: string
  feed_title?: string
  title: string | null
  link: string
  summary: string | null
  published_at: string | null
  fetched_at: string
  saved_article_id: string | null
  is_read: number
  read_at: string | null
}

function rowToFeed(row: FeedRow): Feed {
  return {
    id: row.id,
    title: row.title,
    feedUrl: row.feed_url,
    siteUrl: row.site_url,
    addedAt: row.added_at,
    itemCount: row.item_count,
    unreadCount: row.unread_count,
    lastCheckedAt: row.last_checked_at,
    lastError: row.last_error,
    failureCount: row.failure_count
  }
}

function rowToFeedItem(row: FeedItemRow): FeedItem {
  return {
    id: row.id,
    feedId: row.feed_id,
    feedTitle: row.feed_title,
    title: row.title,
    link: row.link,
    summary: row.summary,
    publishedAt: row.published_at,
    fetchedAt: row.fetched_at,
    savedArticleId: row.saved_article_id,
    isRead: row.is_read === 1,
    readAt: row.read_at
  }
}

export function listFeeds(): Feed[] {
  const db = getDb()
  const rows = db
    .prepare(`${FEED_SELECT} ORDER BY unread_count DESC, f.title COLLATE NOCASE ASC`)
    .all() as unknown as FeedRow[]
  return rows.map(rowToFeed)
}

export function getFeedById(id: string): Feed | null {
  const db = getDb()
  const row = db.prepare(`${FEED_SELECT} WHERE f.id = ?`).get(id) as unknown as FeedRow | undefined
  return row ? rowToFeed(row) : null
}

export function getFeedByUrl(feedUrl: string): Feed | null {
  const db = getDb()
  const row = db.prepare(`${FEED_SELECT} WHERE f.feed_url = ?`).get(feedUrl) as unknown as
    FeedRow | undefined
  return row ? rowToFeed(row) : null
}

export function insertFeed(title: string, feedUrl: string, siteUrl: string | null): Feed {
  const db = getDb()
  const id = randomUUID()
  db.prepare('INSERT INTO feeds (id, title, feed_url, site_url) VALUES (?, ?, ?, ?)').run(
    id,
    title,
    feedUrl,
    siteUrl
  )
  return getFeedById(id)!
}

export function renameFeed(id: string, title: string): Feed {
  const db = getDb()
  db.prepare('UPDATE feeds SET title = ? WHERE id = ?').run(title, id)
  return getFeedById(id)!
}

export function deleteFeed(id: string): void {
  const db = getDb()
  db.prepare('DELETE FROM feeds WHERE id = ?').run(id)
}

export function deleteFeeds(ids: string[]): void {
  if (ids.length === 0) return
  const db = getDb()
  const placeholders = ids.map(() => '?').join(', ')
  db.prepare(`DELETE FROM feeds WHERE id IN (${placeholders})`).run(...ids)
}

export function markFeedOk(id: string): void {
  const db = getDb()
  db.prepare(
    `UPDATE feeds SET last_checked_at = datetime('now'), last_error = NULL, failure_count = 0
     WHERE id = ?`
  ).run(id)
}

export function markFeedFailed(id: string, message: string): void {
  const db = getDb()
  db.prepare(
    `UPDATE feeds SET last_checked_at = datetime('now'), last_error = ?, failure_count = failure_count + 1
     WHERE id = ?`
  ).run(message, id)
}

export interface IncomingFeedItem {
  title: string | null
  link: string
  summary: string | null
  publishedAt: string | null
}

export function upsertFeedItems(feedId: string, items: IncomingFeedItem[]): number {
  const db = getDb()
  const insert = db.prepare(
    `INSERT INTO feed_items (id, feed_id, title, link, summary, published_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(feed_id, link) DO NOTHING`
  )
  let inserted = 0
  db.exec('BEGIN')
  try {
    for (const item of items) {
      const result = insert.run(
        randomUUID(),
        feedId,
        item.title,
        item.link,
        item.summary,
        item.publishedAt
      )
      if (result.changes > 0) inserted += 1
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  return inserted
}

const ITEM_ORDER_BY = 'is_read ASC, published_at DESC, fetched_at DESC'

export function listFeedItems(feedId: string): FeedItem[] {
  const db = getDb()
  const rows = db
    .prepare(`SELECT * FROM feed_items WHERE feed_id = ? ORDER BY ${ITEM_ORDER_BY}`)
    .all(feedId) as unknown as FeedItemRow[]
  return rows.map(rowToFeedItem)
}

const ALL_ITEMS_LIMIT = 500

export function listAllFeedItems(): FeedItem[] {
  const db = getDb()
  const rows = db
    .prepare(
      `SELECT fi.*, f.title AS feed_title
       FROM feed_items fi
       JOIN feeds f ON f.id = fi.feed_id
       ORDER BY ${ITEM_ORDER_BY}
       LIMIT ${ALL_ITEMS_LIMIT}`
    )
    .all() as unknown as FeedItemRow[]
  return rows.map(rowToFeedItem)
}

export function getFeedItemById(id: string): FeedItem | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM feed_items WHERE id = ?').get(id) as unknown as
    FeedItemRow | undefined
  return row ? rowToFeedItem(row) : null
}

export function markFeedItemSaved(feedItemId: string, articleId: string): void {
  const db = getDb()
  db.prepare('UPDATE feed_items SET saved_article_id = ? WHERE id = ?').run(articleId, feedItemId)
}

export function markFeedItemRead(feedItemId: string): FeedItem {
  const db = getDb()
  db.prepare(`UPDATE feed_items SET is_read = 1, read_at = datetime('now') WHERE id = ?`).run(
    feedItemId
  )
  return getFeedItemById(feedItemId)!
}

export function pruneOldFeedItems(maxTotal: number): number {
  const db = getDb()
  const result = db
    .prepare(
      `DELETE FROM feed_items
       WHERE id NOT IN (
         SELECT id FROM feed_items ORDER BY published_at DESC, fetched_at DESC LIMIT ?
       )`
    )
    .run(maxTotal)
  return Number(result.changes)
}

export function markFeedItemUnread(feedItemId: string): FeedItem {
  const db = getDb()
  db.prepare(`UPDATE feed_items SET is_read = 0, read_at = NULL WHERE id = ?`).run(feedItemId)
  return getFeedItemById(feedItemId)!
}

export function markAllFeedItemsRead(feedId?: string): void {
  const db = getDb()
  if (feedId) {
    db.prepare(
      `UPDATE feed_items SET is_read = 1, read_at = datetime('now') WHERE feed_id = ? AND is_read = 0`
    ).run(feedId)
  } else {
    db.prepare(
      `UPDATE feed_items SET is_read = 1, read_at = datetime('now') WHERE is_read = 0`
    ).run()
  }
}
