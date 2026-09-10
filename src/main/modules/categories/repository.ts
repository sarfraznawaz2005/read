import { randomUUID } from 'crypto'
import { getDb } from '../../db'
import type { Category } from '@shared/types'

interface CategoryRow {
  id: string
  name: string
  is_default: number
  created_at: string
}

function rowToCategory(row: CategoryRow): Category {
  return {
    id: row.id,
    name: row.name,
    isDefault: row.is_default === 1,
    createdAt: row.created_at
  }
}

export function listCategories(): Category[] {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM categories ORDER BY is_default DESC, name ASC')
    .all() as unknown as CategoryRow[]
  return rows.map(rowToCategory)
}

export function getDefaultCategoryId(): string {
  const db = getDb()
  const row = db.prepare('SELECT id FROM categories WHERE is_default = 1 LIMIT 1').get() as
    { id: string } | undefined
  return row?.id ?? 'default'
}

export function getCategoryById(id: string): Category | null {
  const db = getDb()
  const row = db.prepare('SELECT * FROM categories WHERE id = ?').get(id) as unknown as
    CategoryRow | undefined
  return row ? rowToCategory(row) : null
}

export function createCategory(name: string): Category {
  const db = getDb()
  const id = randomUUID()
  db.prepare('INSERT INTO categories (id, name, is_default) VALUES (?, ?, 0)').run(id, name)
  return getCategoryById(id)!
}

export function renameCategory(id: string, name: string): Category {
  const db = getDb()
  db.prepare('UPDATE categories SET name = ? WHERE id = ?').run(name, id)
  return getCategoryById(id)!
}

export function deleteCategory(id: string, reassignToId?: string): void {
  const db = getDb()
  const category = getCategoryById(id)
  if (!category) throw new Error(`Category ${id} not found`)
  if (category.isDefault) throw new Error('Cannot delete the Default category')

  const targetId = reassignToId ?? getDefaultCategoryId()
  db.exec('BEGIN')
  try {
    db.prepare('UPDATE articles SET category_id = ? WHERE category_id = ?').run(targetId, id)
    db.prepare('DELETE FROM categories WHERE id = ?').run(id)
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
