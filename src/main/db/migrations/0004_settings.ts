import type { Migration } from './index'

export const migration0004Settings: Migration = {
  id: 4,
  name: 'settings_and_backups',
  sql: `
    CREATE TABLE settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE backups (
      id TEXT PRIMARY KEY,
      file_path TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `
}
