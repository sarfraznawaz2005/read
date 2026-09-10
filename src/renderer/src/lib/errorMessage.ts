// ipcRenderer.invoke() rejections are wrapped like:
// "Error invoking remote method 'article:add': Error: This link has already been saved."
// Strip that wrapper so the user only sees the actual message.
const IPC_WRAPPER = /^Error invoking remote method '[^']*':\s*(?:Error:\s*)?/

export function toErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof Error)) return fallback
  return error.message.replace(IPC_WRAPPER, '').trim() || fallback
}
