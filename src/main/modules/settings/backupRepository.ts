import { randomUUID } from 'crypto'
import { getDb } from '../../db'
import type { BackupRecord } from '@shared/types'

interface BackupRow {
  id: string
  file_path: string
  created_at: string
}

function rowToBackup(row: BackupRow): BackupRecord {
  return { id: row.id, filePath: row.file_path, createdAt: row.created_at }
}

export function listBackups(): BackupRecord[] {
  const db = getDb()
  const rows = db
    .prepare('SELECT * FROM backups ORDER BY created_at DESC')
    .all() as unknown as BackupRow[]
  return rows.map(rowToBackup)
}

export function insertBackup(filePath: string): BackupRecord {
  const db = getDb()
  const id = randomUUID()
  db.prepare('INSERT INTO backups (id, file_path) VALUES (?, ?)').run(id, filePath)
  const row = db.prepare('SELECT * FROM backups WHERE id = ?').get(id) as unknown as BackupRow
  return rowToBackup(row)
}

export function deleteBackup(id: string): string {
  const db = getDb()
  const row = db.prepare('SELECT * FROM backups WHERE id = ?').get(id) as unknown as
    BackupRow | undefined
  db.prepare('DELETE FROM backups WHERE id = ?').run(id)
  return row?.file_path ?? ''
}
