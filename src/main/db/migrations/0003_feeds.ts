import type { Migration } from './index'

export const migration0003Feeds: Migration = {
  id: 3,
  name: 'feeds_and_feed_items',
  sql: `
    CREATE TABLE feeds (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      feed_url TEXT NOT NULL UNIQUE,
      site_url TEXT,
      added_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE feed_items (
      id TEXT PRIMARY KEY,
      feed_id TEXT NOT NULL REFERENCES feeds(id) ON DELETE CASCADE,
      title TEXT,
      link TEXT NOT NULL,
      summary TEXT,
      published_at TEXT,
      fetched_at TEXT NOT NULL DEFAULT (datetime('now')),
      saved_article_id TEXT REFERENCES articles(id)
    );

    CREATE INDEX idx_feed_items_feed_id ON feed_items(feed_id);
    CREATE UNIQUE INDEX idx_feed_items_feed_link ON feed_items(feed_id, link);
  `
}
