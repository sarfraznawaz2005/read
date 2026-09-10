import { create } from 'zustand'
import type { AppSettings, BackupRecord } from '@shared/types'

interface SettingsState {
  settings: AppSettings | null
  backups: BackupRecord[]
  loading: boolean
  loadSettings: () => Promise<void>
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>
  pickBackupFolder: () => Promise<void>
  loadBackups: () => Promise<void>
  backupNow: () => Promise<void>
  importSettings: () => Promise<void>
  exportSettings: () => Promise<string | null>
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: null,
  backups: [],
  loading: false,

  loadSettings: async () => {
    set({ loading: true })
    const settings = await window.api.settings.get()
    set({ settings, loading: false })
  },

  updateSettings: async (patch) => {
    const settings = await window.api.settings.update(patch)
    set({ settings })
  },

  pickBackupFolder: async () => {
    const settings = await window.api.settings.pickBackupFolder()
    if (settings) set({ settings })
  },

  loadBackups: async () => {
    const backups = await window.api.backups.list()
    set({ backups })
  },

  backupNow: async () => {
    await window.api.backups.now()
    await get().loadBackups()
  },

  importSettings: async () => {
    const settings = await window.api.settings.import()
    if (settings) set({ settings })
  },

  exportSettings: async () => window.api.settings.export()
}))
