import { migration0001Init } from './0001_init'
import { migration0002Highlights } from './0002_highlights'
import { migration0003Feeds } from './0003_feeds'
import { migration0004Settings } from './0004_settings'
import { migration0005ReadAt } from './0005_read_at'
import { migration0006FeedState } from './0006_feed_state'
import { migration0007FeedItemPruning } from './0007_feed_item_pruning'
import { migration0008ArticleChunks } from './0008_article_chunks'

export interface Migration {
  id: number
  name: string
  sql: string
}

export const migrations: Migration[] = [
  migration0001Init,
  migration0002Highlights,
  migration0003Feeds,
  migration0004Settings,
  migration0005ReadAt,
  migration0006FeedState,
  migration0007FeedItemPruning,
  migration0008ArticleChunks
]
