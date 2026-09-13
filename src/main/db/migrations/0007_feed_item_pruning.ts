import type { Migration } from './index'

export const migration0007FeedItemPruning: Migration = {
  id: 7,
  name: 'feed_item_soft_pruning',
  sql: `
    ALTER TABLE feed_items ADD COLUMN is_pruned INTEGER NOT NULL DEFAULT 0;
    CREATE INDEX idx_feed_items_pruned ON feed_items(is_pruned);
  `
}
