import { app, dialog } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { listBackups } from './backupRepository'
import { performBackup } from './backupService'
import { getSettings, updateSettings } from './repository'
import type { AppSettings, BackupRecord } from '@shared/types'

function applySideEffects(settings: AppSettings): void {
  app.setLoginItemSettings({ openAtLogin: settings.startWithWindows })
}

export const settingsHandlers = {
  'settings:get': (): AppSettings => getSettings(),
  'settings:update': (_event: unknown, patch: Partial<AppSettings>): AppSettings => {
    const settings = updateSettings(patch)
    applySideEffects(settings)
    return settings
  },
  'settings:pickBackupFolder': async (): Promise<AppSettings | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Choose Backup Folder',
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return updateSettings({ backupFolderPath: result.filePaths[0] })
  },
  'settings:import': async (): Promise<AppSettings | null> => {
    const result = await dialog.showOpenDialog({
      title: 'Import Settings',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    const raw = await readFile(result.filePaths[0], 'utf-8')
    const patch = JSON.parse(raw) as Partial<AppSettings>
    const settings = updateSettings(patch)
    applySideEffects(settings)
    return settings
  },
  'settings:export': async (): Promise<string | null> => {
    const result = await dialog.showSaveDialog({
      title: 'Export Settings',
      defaultPath: 'read-settings.json',
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (result.canceled || !result.filePath) return null
    await writeFile(result.filePath, JSON.stringify(getSettings(), null, 2), 'utf-8')
    return result.filePath
  },
  'backup:now': async (): Promise<BackupRecord | null> => performBackup(),
  'backup:list': (): BackupRecord[] => listBackups()
}
