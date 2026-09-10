import { ipcMain } from 'electron'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type IpcHandler = (event: Electron.IpcMainInvokeEvent, ...args: any[]) => unknown
type IpcHandlerMap = Record<string, IpcHandler>

export function registerIpcHandlers(...handlerMaps: IpcHandlerMap[]): void {
  for (const handlerMap of handlerMaps) {
    for (const [channel, handler] of Object.entries(handlerMap)) {
      ipcMain.handle(channel, handler)
    }
  }
}
