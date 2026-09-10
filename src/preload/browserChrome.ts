import { contextBridge, ipcRenderer } from 'electron'
import type { BrowserChromeState } from '@shared/types'

const chromeApi = {
  back: (): void => ipcRenderer.send('browser-chrome:back'),
  forward: (): void => ipcRenderer.send('browser-chrome:forward'),
  reload: (): void => ipcRenderer.send('browser-chrome:reload'),
  close: (): void => ipcRenderer.send('browser-chrome:close'),
  copyLink: (url: string): void => ipcRenderer.send('browser-chrome:copyLink', url),
  openExternal: (url: string): void => ipcRenderer.send('browser-chrome:openExternal', url),
  onState: (callback: (state: BrowserChromeState) => void): void => {
    ipcRenderer.on('browser-chrome:state', (_event, state: BrowserChromeState) => callback(state))
  }
}

contextBridge.exposeInMainWorld('chromeApi', chromeApi)
