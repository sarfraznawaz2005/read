import { randomUUID } from 'crypto'
import { getDb } from '../../db'
import type {
  Article,
  ArticleListFilter,
  ArticleStatusPatch,
  ExtractionStatus
} from '@shared/types'

interface ArticleRow {
  id: string
  category_id: string
  url: string
  title: string | null
  author: string | null
  content_html: string | null
  content_text: string | null
  images_json: string
  source_domain: string | null
  is_read: number
  is_favorite: number
  is_archived: number
  extraction_status: string
  extraction_error: string | null
  saved_at: string
  last_opened_at: string | null
}

function rowToArticle(row: ArticleRow): Article {
  return {
    id: row.id,
    categoryId: row.category_id,
    url: row.url,
    title: row.title,
    author: row.author,
    contentHtml: row.content_html,
    contentText: row.content_text,
    images: JSON.parse(row.images_json) as string[],
    sourceDomain: row.source_domain,
    isRead: row.is_read === 1,
    isFavorite: row.is_favorite === 1,
    isArchived: row.is_archived === 1,
    extractionStatus: row.extraction_status as ExtractionStatus,
    extractionError: row.extraction_error,
    savedAt: row.saved_at,
    lastOpenedAt: row.last_opened_at
  }
}

function safeHostname(url: string): string | null {
  try {
    return new URL(url).hostname
  } catch {
    return null
  }
}

export function insertPendingArticle(url: string, categoryId: string): Article {
  const db = getDb()
  const id = randomUUID()
  db.prepare(
    `INSERT INTO articles (id, category_id, url, source_domain, extraction_status)
     VALUES (?, ?, ?, ?, 'pending')`
  ).run(id, categoryId, url, safeHostname(url))
  return getArticleById(id)!
}

export function saveExtractionResult(
  id: string,
  result: {
    title: string | null
    author: string | null
    contentHtml: string | null
    contentText: string | null
    images: string[]
  }
): Article {
  const db = getDb()
  db.prepare(
    `UPDATE articles
     SET title = ?, author = ?, content_html = ?, content_text = ?, images_json = ?,
         extraction_status = 'ok', extraction_error = NULL
     WHERE id = ?`
  ).run(
    result.title,
    result.author,
    result.contentHtml,
    result.contentText,
    JSON.stringify(result.images),
    id
  )
  return getArticleById(id)!
}

export function saveExtractionFailure(id: string, errorMessage: string): Article {
  const db = getDb()
  db.prepare(
    `UPDATE articles SET extraction_status = 'failed', extraction_error = ? WHERE id = ?`
  ).run(errorMessage, id)
  return getArticleById(id)!
}

export function markArticleOpened(id: string): Article {
  const db = getDb()
  db.prepare(`UPDATE articles SET last_opened_at = datetime('now') WHERE id = ?`).run(id)
  return getArticleById(id)!
}

export function deleteArticle(id: string): void {
  const db = getDb()
  db.exec('BEGIN')
  try {
    // feed_items.saved_article_id has no ON DELETE action, so clear it first
    // to avoid a foreign key violation.
    db.prepare('UPDATE feed_items SET saved_article_id = NULL WHERE saved_article_id = ?').run(id)
    db.prepare('DELETE FROM articles WHERE id = ?').run(id)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}

export function getArticleById(id: string): Article | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM articles WHERE id = ?').get(id) as unknown as
    ArticleRow | undefined
  return row ? rowToArticle(row) : null
}

export function listArticles(filter: ArticleListFilter): Article[] {
  const db = getDb()
  const clauses: string[] = []
  const params: unknown[] = []

  if (filter.categoryId) {
    clauses.push('category_id = ?')
    params.push(filter.categoryId)
  }

  switch (filter.status) {
    case 'unread':
      clauses.push('is_read = 0 AND is_archived = 0')
      break
    case 'read':
      clauses.push('is_read = 1')
      break
    case 'favorite':
      clauses.push('is_favorite = 1')
      break
    case 'archived':
      clauses.push('is_archived = 1')
      break
    case 'all':
      break
    default:
      clauses.push('is_archived = 0')
  }

  if (filter.query) {
    clauses.push('(title LIKE ? OR content_text LIKE ?)')
    const like = `%${filter.query}%`
    params.push(like, like)
  }

  const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : ''
  const orderBy = ORDER_BY[filter.sort ?? 'date_desc']
  const rows = db
    .prepare(`SELECT * FROM articles ${where} ORDER BY ${orderBy}`)
    .all(...(params as never[])) as unknown as ArticleRow[]
  return rows.map(rowToArticle)
}

const ORDER_BY: Record<NonNullable<ArticleListFilter['sort']>, string> = {
  date_desc: 'saved_at DESC',
  date_asc: 'saved_at ASC',
  title_asc: 'title COLLATE NOCASE ASC',
  read_status: 'is_read ASC, saved_at DESC'
}

export function updateArticleStatus(id: string, patch: ArticleStatusPatch): Article {
  const db = getDb()
  const sets: string[] = []
  const params: unknown[] = []

  if (patch.isRead !== undefined) {
    sets.push('is_read = ?')
    params.push(patch.isRead ? 1 : 0)
    if (patch.isRead) {
      sets.push(`read_at = datetime('now')`)
    } else {
      sets.push('read_at = NULL')
    }
  }
  if (patch.isFavorite !== undefined) {
    sets.push('is_favorite = ?')
    params.push(patch.isFavorite ? 1 : 0)
  }
  if (patch.isArchived !== undefined) {
    sets.push('is_archived = ?')
    params.push(patch.isArchived ? 1 : 0)
  }
  if (patch.categoryId !== undefined) {
    sets.push('category_id = ?')
    params.push(patch.categoryId)
  }

  if (sets.length > 0) {
    params.push(id)
    db.prepare(`UPDATE articles SET ${sets.join(', ')} WHERE id = ?`).run(...(params as never[]))
  }

  return getArticleById(id)!
}
