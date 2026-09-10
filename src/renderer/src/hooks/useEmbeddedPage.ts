import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { BrowserChromeState } from '@shared/types'

const EMPTY_STATE: BrowserChromeState = {
  url: '',
  title: '',
  canGoBack: false,
  canGoForward: false,
  loading: false
}

/**
 * Keeps the main-process embedded WebContentsView aligned to `anchorRef`'s
 * rect. The native view always paints above React, so callers must hide it
 * (visible=false) whenever a dropdown/modal could overlap the anchor.
 */
export function useEmbeddedPage(url: string | null): {
  anchorRef: React.RefObject<HTMLDivElement | null>
  state: BrowserChromeState
  setVisible: (visible: boolean) => void
} {
  const anchorRef = useRef<HTMLDivElement>(null)
  const [state, setState] = useState<BrowserChromeState>(EMPTY_STATE)
  const visibleRef = useRef(true)

  // Reset the displayed state the instant `url` changes (during render, not an
  // effect) so the toolbar never shows the previous page's URL while the new
  // one is still loading.
  const [trackedUrl, setTrackedUrl] = useState<string | null | undefined>(undefined)
  if (url !== trackedUrl) {
    setTrackedUrl(url)
    setState(
      url ? { url, title: '', canGoBack: false, canGoForward: false, loading: true } : EMPTY_STATE
    )
  }

  const syncBounds = useCallback((): void => {
    const el = anchorRef.current
    if (!el || !visibleRef.current) return
    const rect = el.getBoundingClientRect()
    // No client-side dedupe here: the very first call can race the native
    // view's creation in the main process and be silently dropped there, so
    // this must keep resending (the rAF pump below calls it every frame)
    // until the view actually exists and picks up a real size.
    window.api.embed.setBounds({
      x: Math.round(rect.left),
      y: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    })
  }, [])

  const setVisible = useCallback(
    (visible: boolean): void => {
      visibleRef.current = visible
      window.api.embed.setVisible(visible)
      if (visible) syncBounds()
    },
    [syncBounds]
  )

  useLayoutEffect(() => {
    syncBounds()
  })

  useEffect(() => {
    const el = anchorRef.current
    if (!el) return

    const observer = new ResizeObserver(() => syncBounds())
    observer.observe(el)
    window.addEventListener('resize', syncBounds)
    document.addEventListener('scroll', syncBounds, true)

    let raf = 0
    function pump(): void {
      syncBounds()
      raf = requestAnimationFrame(pump)
    }
    raf = requestAnimationFrame(pump)

    return () => {
      observer.disconnect()
      window.removeEventListener('resize', syncBounds)
      document.removeEventListener('scroll', syncBounds, true)
      cancelAnimationFrame(raf)
    }
  }, [syncBounds])

  useEffect(() => {
    return window.api.embed.onState(setState)
  }, [])

  useEffect(() => {
    if (!url) {
      setVisible(false)
      return
    }
    syncBounds()
    setVisible(true)
    void window.api.embed.show(url)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  useEffect(() => {
    return () => {
      void window.api.embed.destroy()
    }
  }, [])

  return { anchorRef, state, setVisible }
}
