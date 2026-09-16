import type { Migration } from './index'

export const migration0008ArticleChunks: Migration = {
  id: 8,
  name: 'article_chunks',
  sql: `
    CREATE TABLE article_chunks (
      id TEXT PRIMARY KEY,
      article_id TEXT NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
      chunk_index INTEGER NOT NULL,
      chunk_text TEXT NOT NULL,
      embedding BLOB,
      embedding_model TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE INDEX idx_article_chunks_article_id ON article_chunks(article_id);
  `
}
