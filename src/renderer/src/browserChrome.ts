import type { BrowserChromeState } from '@shared/types'

declare global {
  interface Window {
    chromeApi: {
      back: () => void
      forward: () => void
      reload: () => void
      close: () => void
      copyLink: (url: string) => void
      openExternal: (url: string) => void
      onState: (callback: (state: BrowserChromeState) => void) => void
    }
  }
}

const backBtn = document.getElementById('back') as HTMLButtonElement
const forwardBtn = document.getElementById('forward') as HTMLButtonElement
const reloadBtn = document.getElementById('reload') as HTMLButtonElement
const copyBtn = document.getElementById('copy') as HTMLButtonElement
const externalBtn = document.getElementById('external') as HTMLButtonElement
const closeBtn = document.getElementById('close') as HTMLButtonElement
const urlText = document.getElementById('url-text') as HTMLSpanElement
const spinner = document.getElementById('spinner') as HTMLSpanElement

let currentUrl = ''

backBtn.addEventListener('click', () => window.chromeApi.back())
forwardBtn.addEventListener('click', () => window.chromeApi.forward())
reloadBtn.addEventListener('click', () => window.chromeApi.reload())
closeBtn.addEventListener('click', () => window.chromeApi.close())
copyBtn.addEventListener('click', () => window.chromeApi.copyLink(currentUrl))
externalBtn.addEventListener('click', () => window.chromeApi.openExternal(currentUrl))

window.chromeApi.onState((state) => {
  currentUrl = state.url
  urlText.textContent = state.title ? `${state.title} — ${state.url}` : state.url || 'Loading…'
  backBtn.disabled = !state.canGoBack
  forwardBtn.disabled = !state.canGoForward
  spinner.classList.toggle('loading', state.loading)
  document.title = state.title || 'Read!'
})
