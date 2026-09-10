import { DatabaseSync } from 'node:sqlite'
import { app } from 'electron'
import { join } from 'path'
import { migrations } from './migrations'

let db: DatabaseSync | null = null

export function getDb(): DatabaseSync {
  if (!db) throw new Error('Database not initialized — call initDb() first')
  return db
}

export function initDb(): DatabaseSync {
  const dbPath = join(app.getPath('userData'), 'read.db')
  db = new DatabaseSync(dbPath)
  db.exec('PRAGMA journal_mode = WAL')
  db.exec('PRAGMA foreign_keys = ON')
  db.exec(
    `CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`
  )

  const appliedIds = new Set(
    (db.prepare('SELECT id FROM _migrations').all() as { id: number }[]).map((row) => row.id)
  )

  for (const migration of migrations) {
    if (appliedIds.has(migration.id)) continue
    db.exec('BEGIN')
    try {
      db.exec(migration.sql)
      db.prepare('INSERT INTO _migrations (id, name) VALUES (?, ?)').run(
        migration.id,
        migration.name
      )
      db.exec('COMMIT')
    } catch (error) {
      db.exec('ROLLBACK')
      throw error
    }
  }

  return db
}
