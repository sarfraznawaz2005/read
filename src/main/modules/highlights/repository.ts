import { randomUUID } from 'crypto'
import { getDb } from '../../db'
import type { Highlight, HighlightColor, TextQuoteAnchor } from '@shared/types'

interface HighlightRow {
  id: string
  article_id: string
  color: string
  anchor_data: string
  selected_text: string
  created_at: string
  updated_at: string
  comment_text: string | null
}

function rowToHighlight(row: HighlightRow): Highlight {
  return {
    id: row.id,
    articleId: row.article_id,
    color: row.color as HighlightColor,
    anchor: JSON.parse(row.anchor_data) as TextQuoteAnchor,
    selectedText: row.selected_text,
    comment: row.comment_text,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

const SELECT_WITH_COMMENT = `
  SELECT h.*, c.text AS comment_text
  FROM highlights h
  LEFT JOIN comments c ON c.highlight_id = h.id
`

export function getHighlightById(id: string): Highlight | null {
  const db = getDb()
  const row = db.prepare(`${SELECT_WITH_COMMENT} WHERE h.id = ?`).get(id) as unknown as
    HighlightRow | undefined
  return row ? rowToHighlight(row) : null
}

export function listHighlightsByArticle(articleId: string): Highlight[] {
  const db = getDb()
  const rows = db
    .prepare(`${SELECT_WITH_COMMENT} WHERE h.article_id = ? ORDER BY h.created_at ASC`)
    .all(articleId) as unknown as HighlightRow[]
  return rows.map(rowToHighlight)
}

export function insertHighlight(
  articleId: string,
  color: HighlightColor,
  anchor: TextQuoteAnchor,
  selectedText: string
): Highlight {
  const db = getDb()
  const id = randomUUID()
  db.prepare(
    `INSERT INTO highlights (id, article_id, color, anchor_data, selected_text)
     VALUES (?, ?, ?, ?, ?)`
  ).run(id, articleId, color, JSON.stringify(anchor), selectedText)
  return getHighlightById(id)!
}

export function updateHighlightColor(id: string, color: HighlightColor): Highlight {
  const db = getDb()
  db.prepare(`UPDATE highlights SET color = ?, updated_at = datetime('now') WHERE id = ?`).run(
    color,
    id
  )
  return getHighlightById(id)!
}

export function deleteHighlight(id: string): void {
  const db = getDb()
  db.prepare('DELETE FROM highlights WHERE id = ?').run(id)
}

export function upsertComment(highlightId: string, text: string): Highlight {
  const db = getDb()
  db.prepare(
    `INSERT INTO comments (id, highlight_id, text)
     VALUES (?, ?, ?)
     ON CONFLICT(highlight_id) DO UPDATE SET text = excluded.text, updated_at = datetime('now')`
  ).run(randomUUID(), highlightId, text)
  return getHighlightById(highlightId)!
}

export function deleteComment(highlightId: string): Highlight {
  const db = getDb()
  db.prepare('DELETE FROM comments WHERE highlight_id = ?').run(highlightId)
  return getHighlightById(highlightId)!
}
