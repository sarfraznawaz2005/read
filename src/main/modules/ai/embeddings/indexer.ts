// Keeps article_chunks current: a debounced background re-embed after every
// successful extraction (never blocks the save's IPC response), plus a manual
// full reindex for Settings' "Rebuild search index" action. Ported from
// AgentDesk's Collections indexer.ts.

import { randomUUID } from 'node:crypto'
import { getDb } from '../../../db'
import { embedText } from './embedder'
import { packVector } from './similarity'
import { chunkArticleText } from './chunker'
import { EMBEDDING_MODEL_ID, isEmbeddingModelDownloaded } from './model-manager'

const DEBOUNCE_MS = 1500
const pendingTimers = new Map<string, ReturnType<typeof setTimeout>>()

async function embedAndStoreArticle(articleId: string): Promise<void> {
  const db = getDb()
  const row = db
    .prepare(
      `SELECT title, content_text AS contentText, extraction_status AS status
       FROM articles WHERE id = ?`
    )
    .get(articleId) as
    { title: string | null; contentText: string | null; status: string } | undefined
  if (!row || row.status !== 'ok' || !row.contentText) return

  const chunks = chunkArticleText(row.title ?? '', row.contentText)

  db.prepare('DELETE FROM article_chunks WHERE article_id = ?').run(articleId)
  const insert = db.prepare(
    `INSERT INTO article_chunks (id, article_id, chunk_index, chunk_text, embedding, embedding_model)
     VALUES (?, ?, ?, ?, ?, ?)`
  )
  for (let i = 0; i < chunks.length; i++) {
    const vector = await embedText(chunks[i])
    insert.run(randomUUID(), articleId, i, chunks[i], packVector(vector), EMBEDDING_MODEL_ID)
  }
}

// Fire-and-forget — callers never await this, so an article save's response is
// never blocked on embedding.
export function scheduleReembed(articleId: string): void {
  if (!isEmbeddingModelDownloaded()) return

  const existing = pendingTimers.get(articleId)
  if (existing) clearTimeout(existing)

  const timer = setTimeout(() => {
    pendingTimers.delete(articleId)
    embedAndStoreArticle(articleId).catch((err) => {
      console.error(`[ai/indexer] Failed to embed article ${articleId}:`, err)
    })
  }, DEBOUNCE_MS)
  pendingTimers.set(articleId, timer)
}

export async function reindexAll(): Promise<{ success: boolean; indexed: number }> {
  if (!isEmbeddingModelDownloaded()) {
    return { success: false, indexed: 0 }
  }

  const db = getDb()
  const articles = db.prepare(`SELECT id FROM articles WHERE extraction_status = 'ok'`).all() as {
    id: string
  }[]

  let indexed = 0
  for (const article of articles) {
    try {
      await embedAndStoreArticle(article.id)
      indexed++
    } catch (err) {
      console.error(`[ai/indexer] Failed to reindex article ${article.id}:`, err)
    }
  }
  return { success: true, indexed }
}
