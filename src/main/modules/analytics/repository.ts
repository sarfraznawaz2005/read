import { getDb } from '../../db'
import type { Analytics } from '@shared/types'

const WORDS_PER_MINUTE = 200
const PER_DAY_WINDOW = 14

export function getAnalytics(): Analytics {
  const db = getDb()

  const totals = db
    .prepare('SELECT COUNT(*) AS total, SUM(is_read) AS read FROM articles')
    .get() as {
    total: number
    read: number | null
  }
  const totalArticles = totals.total
  const readArticles = totals.read ?? 0
  const readPercent = totalArticles > 0 ? Math.round((readArticles / totalArticles) * 100) : 0

  const readDayRows = db
    .prepare('SELECT DISTINCT date(read_at) AS day FROM articles WHERE read_at IS NOT NULL')
    .all() as { day: string }[]
  const readDays = new Set(readDayRows.map((row) => row.day))
  const streakDays = computeStreak(readDays)

  const perDay: { date: string; count: number }[] = []
  for (let i = PER_DAY_WINDOW - 1; i >= 0; i--) {
    const dayStr = daysAgo(i)
    const row = db
      .prepare('SELECT COUNT(*) AS count FROM articles WHERE date(read_at) = ?')
      .get(dayStr) as { count: number }
    perDay.push({ date: dayStr, count: row.count })
  }

  const perCategoryRows = db
    .prepare(
      `SELECT c.id AS categoryId, c.name AS categoryName,
              COUNT(a.id) AS total,
              COALESCE(SUM(a.is_read), 0) AS read
       FROM categories c
       LEFT JOIN articles a ON a.category_id = c.id
       GROUP BY c.id
       ORDER BY c.name COLLATE NOCASE ASC`
    )
    .all() as { categoryId: string; categoryName: string; total: number; read: number }[]

  const textRows = db
    .prepare(
      "SELECT content_text FROM articles WHERE content_text IS NOT NULL AND content_text != ''"
    )
    .all() as { content_text: string }[]
  const totalWords = textRows.reduce(
    (sum, row) => sum + row.content_text.split(/\s+/).filter(Boolean).length,
    0
  )
  const estReadingTimeMinutes = Math.round(totalWords / WORDS_PER_MINUTE)

  const highlightTotals = db.prepare('SELECT COUNT(*) AS count FROM highlights').get() as {
    count: number
  }

  return {
    totalArticles,
    readArticles,
    readPercent,
    streakDays,
    perDay,
    perCategory: perCategoryRows,
    estReadingTimeMinutes,
    totalHighlights: highlightTotals.count
  }
}

function daysAgo(n: number): string {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() - n)
  return date.toISOString().slice(0, 10)
}

function computeStreak(readDays: Set<string>): number {
  let streak = 0
  let offset = readDays.has(daysAgo(0)) ? 0 : 1
  while (readDays.has(daysAgo(offset))) {
    streak += 1
    offset += 1
  }
  return streak
}
