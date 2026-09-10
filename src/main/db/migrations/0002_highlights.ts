import type { Migration } from './index'

export const migration0002Highlights: Migration = {
  id: 2,
  name: 'highlights_and_comments',
  sql: `
    CREATE TABLE highlights (
      id TEXT PRIMARY KEY,
      article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      color TEXT NOT NULL,
      anchor_data TEXT NOT NULL,
      selected_text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE comments (
      id TEXT PRIMARY KEY,
      highlight_id TEXT NOT NULL UNIQUE REFERENCES highlights(id) ON DELETE CASCADE,
      text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      updated_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX idx_highlights_article_id ON highlights(article_id);
  `
}
