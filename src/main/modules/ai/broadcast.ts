import { getMainWindow } from '../../windowRegistry'

export function broadcastToRenderer(channel: string, payload: unknown): void {
  getMainWindow()?.webContents.send(channel, payload)
}
