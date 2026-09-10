import { useEffect, useState } from 'react'
import { useSettingsStore } from '../store/settingsStore'
import { useFeedStore } from '../store/feedStore'

function formatDate(iso: string): string {
  return new Date(iso.replace(' ', 'T') + 'Z').toLocaleString()
}

export function SettingsView({ onBack }: { onBack: () => void }): React.JSX.Element {
  const {
    settings,
    backups,
    loadSettings,
    updateSettings,
    pickBackupFolder,
    loadBackups,
    backupNow,
    importSettings,
    exportSettings
  } = useSettingsStore()
  const { importOpml, exportOpml } = useFeedStore()
  const [backingUp, setBackingUp] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)

  useEffect(() => {
    void loadSettings()
    void loadBackups()
  }, [loadSettings, loadBackups])

  async function handleBackupNow(): Promise<void> {
    setBackingUp(true)
    try {
      await backupNow()
      setStatusMessage('Backup created.')
    } finally {
      setBackingUp(false)
    }
  }

  async function handleExportSettings(): Promise<void> {
    const path = await exportSettings()
    if (path) setStatusMessage(`Settings exported to ${path}`)
  }

  async function handleImportOpml(): Promise<void> {
    const result = await importOpml()
    if (result) setStatusMessage(`Imported ${result.added} feed(s), skipped ${result.skipped}`)
  }

  async function handleExportOpml(): Promise<void> {
    const path = await exportOpml()
    if (path) setStatusMessage(`Feeds exported to ${path}`)
  }

  if (!settings) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white text-slate-400 dark:bg-slate-900">
        Loading settings…
      </div>
    )
  }

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-200">
      <header className="flex items-center gap-4 border-b border-slate-200 px-8 py-4 dark:border-slate-800">
        <button
          onClick={onBack}
          className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
        >
          ← Back to Library
        </button>
        <h2 className="text-xs font-bold uppercase tracking-wider text-slate-400">Preferences</h2>
      </header>

      <main className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-3xl space-y-8">
          {statusMessage && (
            <div className="rounded-lg bg-emerald-50 px-4 py-3 text-xs text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300">
              {statusMessage}
            </div>
          )}

          {/* Appearance */}
          <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-6 dark:border-slate-800 dark:bg-slate-800/40">
            <h3 className="text-sm font-bold">🎨 Appearance & Theme</h3>
            <div className="grid grid-cols-2 gap-4">
              {(['light', 'dark'] as const).map((theme) => (
                <button
                  key={theme}
                  onClick={() => updateSettings({ theme })}
                  className={`rounded-lg border-2 p-4 text-left ${
                    settings.theme === theme
                      ? 'border-indigo-500 bg-white dark:bg-slate-900'
                      : 'border-slate-200 bg-white hover:border-slate-300 dark:border-slate-700 dark:bg-slate-900'
                  }`}
                >
                  <div className="mb-1 text-xs font-bold capitalize">{theme}</div>
                  <div className="text-[11px] text-slate-400">
                    {theme === 'light'
                      ? 'Crisp, high-contrast day theme'
                      : 'Calm dark night palette'}
                  </div>
                </button>
              ))}
            </div>
          </section>

          {/* Windows integration */}
          <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-6 text-xs dark:border-slate-800 dark:bg-slate-800/40">
            <h3 className="text-sm font-bold">🪟 Windows OS Integration</h3>
            <label className="flex cursor-pointer items-center justify-between gap-4">
              <div>
                <div className="font-medium">Start with Windows</div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  Launch in background on system login
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.startWithWindows}
                onChange={(event) => updateSettings({ startWithWindows: event.target.checked })}
                className="h-4 w-4 flex-shrink-0"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-4 border-t border-slate-200 pt-4 dark:border-slate-700">
              <div>
                <div className="font-medium">Minimize to System Tray</div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  Keep running in the tray when minimized
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.minimizeToTray}
                onChange={(event) => updateSettings({ minimizeToTray: event.target.checked })}
                className="h-4 w-4 flex-shrink-0"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between gap-4 border-t border-slate-200 pt-4 dark:border-slate-700">
              <div>
                <div className="font-medium">Close to System Tray</div>
                <div className="mt-0.5 text-[11px] text-slate-400">
                  Clicking the close button hides to tray instead of quitting
                </div>
              </div>
              <input
                type="checkbox"
                checked={settings.closeToTray}
                onChange={(event) => updateSettings({ closeToTray: event.target.checked })}
                className="h-4 w-4 flex-shrink-0"
              />
            </label>
          </section>

          {/* Feed settings */}
          <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-6 text-xs dark:border-slate-800 dark:bg-slate-800/40">
            <h3 className="text-sm font-bold">📡 Feed Settings</h3>
            <div className="grid grid-cols-4 gap-4">
              <label className="block">
                <div className="mb-1.5 font-medium">Scan interval (min)</div>
                <input
                  type="number"
                  min={5}
                  value={settings.feedScanIntervalMinutes}
                  onChange={(event) =>
                    updateSettings({ feedScanIntervalMinutes: Number(event.target.value) || 5 })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                />
              </label>
              <label className="block">
                <div className="mb-1.5 font-medium">Max entries per feed</div>
                <input
                  type="number"
                  min={1}
                  value={settings.feedMaxEntriesPerFeed}
                  onChange={(event) =>
                    updateSettings({ feedMaxEntriesPerFeed: Number(event.target.value) || 1 })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                />
              </label>
              <label className="block">
                <div className="mb-1.5 font-medium">Skip entries older than (days)</div>
                <input
                  type="number"
                  min={0}
                  value={settings.feedMaxAgeDays}
                  onChange={(event) =>
                    updateSettings({ feedMaxAgeDays: Number(event.target.value) || 0 })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                />
              </label>
              <label className="block">
                <div className="mb-1.5 font-medium">Max stored articles (total)</div>
                <input
                  type="number"
                  min={0}
                  value={settings.feedMaxTotalEntries}
                  onChange={(event) =>
                    updateSettings({ feedMaxTotalEntries: Number(event.target.value) || 0 })
                  }
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
                />
              </label>
            </div>
            <div className="flex items-center gap-3 border-t border-slate-200 pt-4 dark:border-slate-700">
              <button
                onClick={handleImportOpml}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                Import OPML...
              </button>
              <button
                onClick={handleExportOpml}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                Export OPML...
              </button>
            </div>
          </section>

          {/* Backup */}
          <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-6 text-xs dark:border-slate-800 dark:bg-slate-800/40">
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-sm font-bold">💾 Automatic Rolling Backup (Max 5)</h3>
              <button
                onClick={handleBackupNow}
                disabled={backingUp || !settings.backupFolderPath}
                className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white shadow hover:bg-indigo-500 disabled:opacity-50"
              >
                {backingUp ? 'Backing up…' : 'Backup Now'}
              </button>
            </div>
            <div className="flex items-center gap-3">
              <span className="flex-shrink-0 text-slate-400">Backup Location:</span>
              <span className="flex-1 truncate rounded border border-slate-200 bg-white px-2 py-1.5 font-mono text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                {settings.backupFolderPath ?? 'Not set'}
              </span>
              <button
                onClick={pickBackupFolder}
                className="flex-shrink-0 rounded bg-slate-200 px-3 py-1.5 text-slate-700 hover:bg-slate-300 dark:bg-slate-700 dark:text-slate-200"
              >
                Choose Folder
              </button>
            </div>
            {backups.length > 0 && (
              <table className="w-full overflow-hidden rounded-lg border border-slate-200 text-left dark:border-slate-700">
                <thead className="bg-slate-100 text-slate-400 dark:bg-slate-900">
                  <tr>
                    <th className="p-2">Filename</th>
                    <th className="p-2">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 font-mono text-[11px] dark:divide-slate-700">
                  {backups.map((backup) => (
                    <tr key={backup.id}>
                      <td className="max-w-xs truncate p-2">
                        {backup.filePath.split(/[/\\]/).pop()}
                      </td>
                      <td className="p-2">{formatDate(backup.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>

          {/* Import/Export settings */}
          <section className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-6 text-xs dark:border-slate-800 dark:bg-slate-800/40">
            <h3 className="text-sm font-bold">⚙️ Import & Export Settings (JSON)</h3>
            <div className="flex items-center gap-3">
              <button
                onClick={() => importSettings()}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                Import Settings File...
              </button>
              <button
                onClick={handleExportSettings}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
              >
                Export Settings File...
              </button>
            </div>
          </section>
        </div>
      </main>
    </div>
  )
}
