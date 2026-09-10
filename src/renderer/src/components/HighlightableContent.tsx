import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import type { Article, HighlightColor, TextQuoteAnchor } from '@shared/types'
import { useAppStore } from '../store/appStore'
import { computeAnchorFromSelection, HIGHLIGHT_SWATCH, renderHighlights } from '../lib/highlightDom'
import { applyFindHighlight, findAllMatches, clearFindMatches } from '../lib/findInArticle'

const COLORS: HighlightColor[] = ['yellow', 'green', 'rose', 'blue']

export interface HighlightableContentHandle {
  find: (query: string) => number
  findNext: () => void
  findPrev: () => void
  clearFind: () => void
}

interface SelectionPopup {
  x: number
  y: number
  anchor: TextQuoteAnchor
}

interface CommentPopover {
  x: number
  y: number
  highlightId: string
}

interface ContextMenuState {
  x: number
  y: number
  anchor: TextQuoteAnchor | null
  linkHref: string | null
}

export const HighlightableContent = forwardRef<HighlightableContentHandle, { article: Article }>(
  function HighlightableContent({ article }, ref) {
    const {
      highlights,
      loadHighlights,
      addHighlight,
      updateHighlightColor,
      deleteHighlight,
      upsertComment,
      deleteComment,
      updateStatus
    } = useAppStore()
    const containerRef = useRef<HTMLDivElement>(null)
    const popupRef = useRef<HTMLDivElement>(null)
    const [selectionPopup, setSelectionPopup] = useState<SelectionPopup | null>(null)
    const [commentPopover, setCommentPopover] = useState<CommentPopover | null>(null)
    const [commentDraft, setCommentDraft] = useState('')
    const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
    const findStateRef = useRef<{
      matches: ReturnType<typeof findAllMatches>
      activeIndex: number
    }>({ matches: [], activeIndex: 0 })

    useImperativeHandle(ref, () => ({
      find: (query) => {
        if (!containerRef.current) return 0
        const matches = findAllMatches(containerRef.current, query)
        findStateRef.current = { matches, activeIndex: 0 }
        applyFindHighlight(containerRef.current, matches, 0)
        return matches.length
      },
      findNext: () => {
        if (!containerRef.current) return
        const state = findStateRef.current
        if (state.matches.length === 0) return
        state.activeIndex = (state.activeIndex + 1) % state.matches.length
        applyFindHighlight(containerRef.current, state.matches, state.activeIndex)
      },
      findPrev: () => {
        if (!containerRef.current) return
        const state = findStateRef.current
        if (state.matches.length === 0) return
        state.activeIndex = (state.activeIndex - 1 + state.matches.length) % state.matches.length
        applyFindHighlight(containerRef.current, state.matches, state.activeIndex)
      },
      clearFind: () => {
        if (!containerRef.current) return
        clearFindMatches(containerRef.current)
        findStateRef.current = { matches: [], activeIndex: 0 }
      }
    }))

    function openCommentPopover(highlightId: string, rect: DOMRect): void {
      const highlight = highlights.find((h) => h.id === highlightId)
      setCommentDraft(highlight?.comment ?? '')
      setCommentPopover({ highlightId, x: rect.left, y: rect.bottom + 8 })
      setSelectionPopup(null)
    }

    useEffect(() => {
      void loadHighlights(article.id)
    }, [article.id, loadHighlights])

    useEffect(() => {
      if (!containerRef.current) return
      renderHighlights(
        containerRef.current,
        article.contentHtml ?? '',
        highlights,
        (highlightId) => {
          const mark = containerRef.current?.querySelector(`[data-highlight-id="${highlightId}"]`)
          if (mark) openCommentPopover(highlightId, mark.getBoundingClientRect())
        }
      )
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [article.contentHtml, highlights])

    useEffect(() => {
      if (!selectionPopup && !commentPopover && !contextMenu) return
      const handleClickAway = (event: MouseEvent): void => {
        if (popupRef.current?.contains(event.target as Node)) return
        setSelectionPopup(null)
        setCommentPopover(null)
        setContextMenu(null)
      }
      document.addEventListener('mousedown', handleClickAway)
      return () => document.removeEventListener('mousedown', handleClickAway)
    }, [selectionPopup, commentPopover, contextMenu])

    function handleMouseUp(): void {
      const selection = window.getSelection()
      if (!selection || !containerRef.current) {
        setSelectionPopup(null)
        return
      }
      const anchor = computeAnchorFromSelection(containerRef.current, selection)
      if (!anchor) {
        setSelectionPopup(null)
        return
      }
      const rect = selection.getRangeAt(0).getBoundingClientRect()
      setSelectionPopup({ x: rect.left, y: rect.top, anchor })
      setCommentPopover(null)
    }

    function handleContextMenu(event: React.MouseEvent): void {
      event.preventDefault()
      const selection = window.getSelection()
      const anchor =
        selection && containerRef.current
          ? computeAnchorFromSelection(containerRef.current, selection)
          : null
      const linkEl = (event.target as HTMLElement).closest('a')
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        anchor,
        linkHref: linkEl?.getAttribute('href') ?? null
      })
      setSelectionPopup(null)
      setCommentPopover(null)
    }

    async function createHighlight(anchor: TextQuoteAnchor, color: HighlightColor): Promise<void> {
      await addHighlight(article.id, anchor, color, anchor.exact)
      window.getSelection()?.removeAllRanges()
    }

    async function handlePickColor(color: HighlightColor): Promise<void> {
      if (!selectionPopup) return
      await createHighlight(selectionPopup.anchor, color)
      setSelectionPopup(null)
    }

    async function handleAddNote(): Promise<void> {
      if (!selectionPopup) return
      const highlight = await addHighlight(
        article.id,
        selectionPopup.anchor,
        'yellow',
        selectionPopup.anchor.exact
      )
      window.getSelection()?.removeAllRanges()
      setCommentDraft('')
      setCommentPopover({
        highlightId: highlight.id,
        x: selectionPopup.x,
        y: selectionPopup.y + 32
      })
      setSelectionPopup(null)
    }

    async function handleMenuHighlight(color: HighlightColor): Promise<void> {
      if (!contextMenu?.anchor) return
      await createHighlight(contextMenu.anchor, color)
      setContextMenu(null)
    }

    async function handleMenuAddComment(): Promise<void> {
      if (!contextMenu?.anchor) return
      const { x, y, anchor } = contextMenu
      const highlight = await addHighlight(article.id, anchor, 'yellow', anchor.exact)
      window.getSelection()?.removeAllRanges()
      setCommentDraft('')
      setCommentPopover({ highlightId: highlight.id, x, y: y + 8 })
      setContextMenu(null)
    }

    function handleMenuCopy(): void {
      if (contextMenu?.anchor) void navigator.clipboard.writeText(contextMenu.anchor.exact)
      setContextMenu(null)
    }

    function handleMenuCopyLink(): void {
      if (contextMenu?.linkHref) void navigator.clipboard.writeText(contextMenu.linkHref)
      setContextMenu(null)
    }

    function handleMenuOpenLink(): void {
      if (contextMenu?.linkHref) void window.api.browser.open(contextMenu.linkHref)
      setContextMenu(null)
    }

    function handleMenuToggleRead(): void {
      void updateStatus(article.id, { isRead: !article.isRead })
      setContextMenu(null)
    }

    const activeComment = commentPopover
      ? (highlights.find((h) => h.id === commentPopover.highlightId) ?? null)
      : null

    return (
      <div className="relative">
        <div ref={containerRef} onMouseUp={handleMouseUp} onContextMenu={handleContextMenu} />

        {selectionPopup && (
          <div
            ref={popupRef}
            className="fixed z-40 flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1.5 shadow-2xl dark:border-slate-700 dark:bg-slate-800"
            style={{ left: selectionPopup.x, top: Math.max(8, selectionPopup.y - 48) }}
          >
            <span className="px-1 text-[10px] font-bold uppercase text-slate-400">Highlight:</span>
            {COLORS.map((color) => (
              <button
                key={color}
                title={color}
                onClick={() => handlePickColor(color)}
                className="h-6 w-6 rounded-full shadow-sm transition-transform hover:scale-110"
                style={{ backgroundColor: HIGHLIGHT_SWATCH[color] }}
              />
            ))}
            <span className="mx-0.5 h-4 w-px bg-slate-200 dark:bg-slate-700" />
            <button
              onClick={handleAddNote}
              className="rounded bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-200 dark:hover:bg-slate-600"
            >
              💬 Add Note
            </button>
          </div>
        )}

        {contextMenu && (
          <div
            ref={popupRef}
            className="fixed z-50 w-56 rounded-xl border border-slate-200 bg-white py-1.5 text-xs text-slate-700 shadow-2xl dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            style={{ left: contextMenu.x, top: contextMenu.y }}
          >
            <button
              disabled={!contextMenu.anchor}
              onClick={handleMenuCopy}
              className="flex w-full items-center justify-between px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-700"
            >
              Copy
            </button>
            <div className="group relative">
              <div
                className={`flex items-center justify-between px-3 py-1.5 ${
                  contextMenu.anchor
                    ? 'cursor-pointer hover:bg-indigo-600 hover:text-white'
                    : 'opacity-40'
                }`}
              >
                <span>🖍️ Highlight</span>
                <span className="text-[10px] text-slate-400">▶</span>
              </div>
              {contextMenu.anchor && (
                <div className="absolute left-full top-0 ml-1 hidden w-32 rounded-xl border border-slate-200 bg-white py-1 shadow-2xl group-hover:block dark:border-slate-700 dark:bg-slate-800">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => handleMenuHighlight(color)}
                      className="flex w-full items-center gap-2 px-3 py-1 text-left hover:bg-indigo-600 hover:text-white"
                    >
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: HIGHLIGHT_SWATCH[color] }}
                      />
                      {color[0].toUpperCase() + color.slice(1)}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button
              disabled={!contextMenu.anchor}
              onClick={handleMenuAddComment}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-slate-700"
            >
              💬 Add Comment Note
            </button>
            {contextMenu.linkHref && (
              <>
                <div className="my-1 h-px bg-slate-100" />
                <button
                  onClick={handleMenuOpenLink}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white"
                >
                  🔗 Open Link
                </button>
                <button
                  onClick={handleMenuCopyLink}
                  className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white"
                >
                  📋 Copy Link Address
                </button>
              </>
            )}
            <div className="my-1 h-px bg-slate-100" />
            <button
              onClick={handleMenuToggleRead}
              className="flex w-full items-center gap-2 px-3 py-1.5 text-left hover:bg-indigo-600 hover:text-white"
            >
              {article.isRead ? '✓ Mark as Unread' : '✓ Mark as Read'}
            </button>
          </div>
        )}

        {commentPopover && activeComment && (
          <div
            ref={popupRef}
            className="fixed z-50 w-80 rounded-xl border border-indigo-200 bg-white p-4 shadow-2xl dark:border-indigo-800 dark:bg-slate-800"
            style={{ left: commentPopover.x, top: commentPopover.y }}
          >
            <div className="mb-2 flex items-center justify-between border-b border-slate-100 pb-2 dark:border-slate-700">
              <div className="flex items-center gap-1.5">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: HIGHLIGHT_SWATCH[activeComment.color] }}
                />
                <span className="text-xs font-bold text-slate-700 dark:text-slate-200">
                  Highlight Annotation
                </span>
              </div>
              <button
                onClick={() => setCommentPopover(null)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                ✕
              </button>
            </div>

            <p className="mb-3 line-clamp-3 text-xs italic text-slate-500 dark:text-slate-400">
              &ldquo;{activeComment.selectedText}&rdquo;
            </p>

            <textarea
              value={commentDraft}
              onChange={(event) => setCommentDraft(event.target.value)}
              placeholder="Add a note..."
              rows={2}
              className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:border-indigo-500 focus:outline-none dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
            />

            <div className="mt-2 flex items-center justify-between">
              <div className="flex items-center gap-1">
                {COLORS.map((color) => (
                  <button
                    key={color}
                    title={color}
                    onClick={() => updateHighlightColor(activeComment.id, color)}
                    className={`h-4 w-4 rounded-full ${
                      activeComment.color === color ? 'ring-2 ring-indigo-500' : ''
                    }`}
                    style={{ backgroundColor: HIGHLIGHT_SWATCH[color] }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={async () => {
                    await deleteHighlight(activeComment.id)
                    setCommentPopover(null)
                  }}
                  className="rounded px-2 py-1 text-xs text-rose-500 hover:bg-rose-50"
                >
                  Delete
                </button>
                <button
                  onClick={async () => {
                    if (commentDraft.trim()) {
                      await upsertComment(activeComment.id, commentDraft.trim())
                    } else if (activeComment.comment) {
                      await deleteComment(activeComment.id)
                    }
                    setCommentPopover(null)
                  }}
                  className="rounded-md bg-indigo-600 px-3 py-1 text-xs font-medium text-white hover:bg-indigo-500"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }
)
