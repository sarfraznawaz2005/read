import { getDb } from '../../db'
import type { AppSettings } from '@shared/types'

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'light',
  startWithWindows: false,
  startMinimized: false,
  minimizeToTray: false,
  closeToTray: false,
  backupFolderPath: null,
  readerFontFamily: 'Georgia, "Times New Roman", serif',
  readerFontSize: 18,
  readerBackground: 'Paper White',
  feedScanIntervalMinutes: 60,
  feedMaxEntriesPerFeed: 50,
  feedMaxAgeDays: 30,
  feedMaxTotalEntries: 100
}

export function getSettings(): AppSettings {
  const db = getDb()
  const rows = db.prepare('SELECT key, value FROM settings').all() as unknown as {
    key: string
    value: string
  }[]
  const stored: Partial<AppSettings> = {}
  for (const row of rows) {
    try {
      ;(stored as Record<string, unknown>)[row.key] = JSON.parse(row.value)
    } catch {
      continue
    }
  }
  return { ...DEFAULT_SETTINGS, ...stored }
}

export function updateSettings(patch: Partial<AppSettings>): AppSettings {
  const db = getDb()
  const upsert = db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  )
  db.exec('BEGIN')
  try {
    for (const [key, value] of Object.entries(patch)) {
      upsert.run(key, JSON.stringify(value))
    }
    db.exec('COMMIT')
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
  return getSettings()
}
