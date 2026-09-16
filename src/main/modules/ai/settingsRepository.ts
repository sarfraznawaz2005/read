import { getDb } from '../../db'
import { encryptSecret, decryptSecret } from './secureStore'
import type { AiProviderType, AiSettings, AiSettingsPatch } from '@shared/types'

// Reuses the existing generic settings(key, value) table with a namespaced key
// prefix, rather than adding new columns/tables — keeps this feature's storage
// footprint to the one article_chunks migration.
const KEY_PROVIDER = 'ai.provider'
const KEY_MODEL = 'ai.model'
const KEY_GEMINI_KEY = 'ai.geminiApiKeyEncrypted'
const KEY_OPENROUTER_KEY = 'ai.openRouterApiKeyEncrypted'

function readRaw(key: string): string | null {
  const db = getDb()
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key) as
    { value: string } | undefined
  if (!row) return null
  try {
    return JSON.parse(row.value) as string
  } catch {
    return null
  }
}

function writeRaw(key: string, value: string | null): void {
  const db = getDb()
  if (value === null) {
    db.prepare('DELETE FROM settings WHERE key = ?').run(key)
    return
  }
  db.prepare(
    `INSERT INTO settings (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`
  ).run(key, JSON.stringify(value))
}

export function getAiSettings(): AiSettings {
  return {
    provider: (readRaw(KEY_PROVIDER) as AiProviderType | null) ?? 'opencode',
    model: readRaw(KEY_MODEL),
    hasGeminiApiKey: readRaw(KEY_GEMINI_KEY) !== null,
    hasOpenRouterApiKey: readRaw(KEY_OPENROUTER_KEY) !== null
  }
}

export function updateAiSettings(patch: AiSettingsPatch): AiSettings {
  if (patch.provider !== undefined) writeRaw(KEY_PROVIDER, patch.provider)
  if (patch.model !== undefined) writeRaw(KEY_MODEL, patch.model)
  if (patch.geminiApiKey !== undefined) {
    writeRaw(KEY_GEMINI_KEY, patch.geminiApiKey ? encryptSecret(patch.geminiApiKey) : null)
  }
  if (patch.openRouterApiKey !== undefined) {
    writeRaw(
      KEY_OPENROUTER_KEY,
      patch.openRouterApiKey ? encryptSecret(patch.openRouterApiKey) : null
    )
  }
  return getAiSettings()
}

/** Decrypted key for internal use by the chat engine — never sent to the renderer. */
export function getDecryptedApiKey(provider: AiProviderType): string {
  const key =
    provider === 'gemini' ? KEY_GEMINI_KEY : provider === 'openrouter' ? KEY_OPENROUTER_KEY : null
  if (!key) return ''
  const stored = readRaw(key)
  return stored ? decryptSecret(stored) : ''
}
