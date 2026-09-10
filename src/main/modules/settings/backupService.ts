import { backup as sqliteBackup } from 'node:sqlite'
import { randomBytes } from 'crypto'
import { join } from 'path'
import { unlink } from 'fs/promises'
import { getDb } from '../../db'
import { deleteBackup, insertBackup, listBackups } from './backupRepository'
import { getSettings } from './repository'
import type { BackupRecord } from '@shared/types'

const MAX_BACKUPS = 5

function timestampedFilename(): string {
  const now = new Date()
  const pad = (n: number): string => String(n).padStart(2, '0')
  const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const time = `${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
  const suffix = randomBytes(3).toString('hex')
  return `read_backup_${date}_${time}_${suffix}.db`
}

export async function performBackup(): Promise<BackupRecord | null> {
  const settings = getSettings()
  if (!settings.backupFolderPath) return null

  const destPath = join(settings.backupFolderPath, timestampedFilename())
  await sqliteBackup(getDb(), destPath)
  const record = insertBackup(destPath)

  const all = listBackups()
  if (all.length > MAX_BACKUPS) {
    for (const old of all.slice(MAX_BACKUPS)) {
      const filePath = deleteBackup(old.id)
      if (filePath) await unlink(filePath).catch(() => {})
    }
  }

  return record
}
