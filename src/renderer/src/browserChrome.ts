import type { BrowserChromeState } from '@shared/types'

declare global {
  interface Window {
    chromeApi: {
      back: () => void
      forward: () => void
      reload: () => void
      navigate: (url: string) => void
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
const urlText = document.getElementById('url-text') as HTMLInputElement
const spinner = document.getElementById('spinner') as HTMLSpanElement

let currentUrl = ''

backBtn.addEventListener('click', () => window.chromeApi.back())
forwardBtn.addEventListener('click', () => window.chromeApi.forward())
reloadBtn.addEventListener('click', () => window.chromeApi.reload())
closeBtn.addEventListener('click', () => window.chromeApi.close())
copyBtn.addEventListener('click', () => window.chromeApi.copyLink(currentUrl))
externalBtn.addEventListener('click', () => window.chromeApi.openExternal(currentUrl))

urlText.addEventListener('focus', () => urlText.select())
urlText.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    urlText.blur()
    if (urlText.value.trim()) window.chromeApi.navigate(urlText.value.trim())
  } else if (event.key === 'Escape') {
    urlText.value = currentUrl
    urlText.blur()
  }
})

window.chromeApi.onState((state) => {
  currentUrl = state.url
  // Don't stomp on what the user is typing while they're mid-edit.
  if (document.activeElement !== urlText) {
    urlText.value = state.url || 'Loading…'
  }
  backBtn.disabled = !state.canGoBack
  forwardBtn.disabled = !state.canGoForward
  spinner.classList.toggle('loading', state.loading)
  document.title = state.title || 'Read!'
})
