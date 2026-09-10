import type { Migration } from './index'

export const migration0006FeedState: Migration = {
  id: 6,
  name: 'feed_state_and_read_status',
  sql: `
    ALTER TABLE feeds ADD COLUMN last_checked_at TEXT;
    ALTER TABLE feeds ADD COLUMN last_error TEXT;
    ALTER TABLE feeds ADD COLUMN failure_count INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE feed_items ADD COLUMN is_read INTEGER NOT NULL DEFAULT 0;
    ALTER TABLE feed_items ADD COLUMN read_at TEXT;
    CREATE INDEX idx_feed_items_unread ON feed_items(feed_id, is_read);
  `
}
