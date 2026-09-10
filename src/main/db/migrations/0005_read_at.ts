import type { Migration } from './index'

export const migration0005ReadAt: Migration = {
  id: 5,
  name: 'articles_read_at',
  sql: `
    ALTER TABLE articles ADD COLUMN read_at TEXT;
  `
}
