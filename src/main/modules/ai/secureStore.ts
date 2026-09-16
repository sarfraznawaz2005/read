import { safeStorage } from 'electron'

// API keys are encrypted at rest with Electron's OS-backed safeStorage (DPAPI on
// Windows) rather than stored as plain text in the settings table. This is a
// deliberate one-way trip: an encrypted key is tied to this machine/user account,
// so it is never included in Settings export/import — re-entering it after a
// restore on another machine is the expected flow.
export function encryptSecret(plain: string): string {
  if (!safeStorage.isEncryptionAvailable()) return plain
  return safeStorage.encryptString(plain).toString('base64')
}

export function decryptSecret(stored: string): string {
  if (!safeStorage.isEncryptionAvailable()) return stored
  try {
    return safeStorage.decryptString(Buffer.from(stored, 'base64'))
  } catch {
    return ''
  }
}
