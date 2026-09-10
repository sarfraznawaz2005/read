import type { Migration } from './index'

export const migration0001Init: Migration = {
  id: 1,
  name: 'init_categories_and_articles',
  sql: `
    CREATE TABLE categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE articles (
      id TEXT PRIMARY KEY,
      category_id TEXT NOT NULL REFERENCES categories(id),
      url TEXT NOT NULL,
      title TEXT,
      author TEXT,
      content_html TEXT,
      content_text TEXT,
      images_json TEXT NOT NULL DEFAULT '[]',
      source_domain TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      is_favorite INTEGER NOT NULL DEFAULT 0,
      is_archived INTEGER NOT NULL DEFAULT 0,
      extraction_status TEXT NOT NULL DEFAULT 'pending',
      extraction_error TEXT,
      saved_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_opened_at TEXT
    );

    CREATE INDEX idx_articles_category_id ON articles(category_id);
    CREATE INDEX idx_articles_saved_at ON articles(saved_at);

    INSERT INTO categories (id, name, is_default) VALUES ('default', 'Default', 1);
  `
}
