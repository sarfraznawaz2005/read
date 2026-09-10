import type { Highlight, HighlightColor, TextQuoteAnchor } from '@shared/types'

export const HIGHLIGHT_SWATCH: Record<HighlightColor, string> = {
  yellow: '#facc15',
  green: '#34d399',
  rose: '#fb7185',
  blue: '#38bdf8'
}

const HIGHLIGHT_BACKGROUND: Record<HighlightColor, string> = {
  yellow: 'rgba(250, 204, 21, 0.45)',
  green: 'rgba(52, 211, 153, 0.4)',
  rose: 'rgba(251, 113, 133, 0.4)',
  blue: 'rgba(56, 189, 248, 0.4)'
}

export interface NodeRange {
  node: Text
  start: number
  end: number
}

export function findTextNodes(container: Node): Text[] {
  const walker = document.createTreeWalker(container, NodeFilter.SHOW_TEXT)
  const nodes: Text[] = []
  let node = walker.nextNode()
  while (node) {
    nodes.push(node as Text)
    node = walker.nextNode()
  }
  return nodes
}

export function buildNodeRanges(nodes: Text[]): { text: string; ranges: NodeRange[] } {
  let text = ''
  const ranges: NodeRange[] = []
  for (const node of nodes) {
    const start = text.length
    text += node.data
    ranges.push({ node, start, end: start + node.data.length })
  }
  return { text, ranges }
}

function findBestMatch(
  fullText: string,
  anchor: TextQuoteAnchor
): { start: number; end: number } | null {
  if (!anchor.exact) return null
  let index = fullText.indexOf(anchor.exact)
  if (index === -1) return null

  let bestIndex = index
  let bestScore = -1
  while (index !== -1) {
    const before = fullText.slice(Math.max(0, index - anchor.prefix.length), index)
    const after = fullText.slice(
      index + anchor.exact.length,
      index + anchor.exact.length + anchor.suffix.length
    )
    let score = 0
    if (before === anchor.prefix) score += 1
    if (after === anchor.suffix) score += 1
    if (score > bestScore) {
      bestScore = score
      bestIndex = index
    }
    index = fullText.indexOf(anchor.exact, index + 1)
  }
  return { start: bestIndex, end: bestIndex + anchor.exact.length }
}

function wrapMatch(
  ranges: NodeRange[],
  start: number,
  end: number,
  highlight: Highlight,
  onClick: (highlightId: string) => void
): void {
  for (const { node, start: nodeStart, end: nodeEnd } of ranges) {
    if (nodeEnd <= start || nodeStart >= end) continue
    const localStart = Math.max(0, start - nodeStart)
    const localEnd = Math.min(node.data.length, end - nodeStart)
    if (localStart >= localEnd) continue

    const range = document.createRange()
    range.setStart(node, localStart)
    range.setEnd(node, localEnd)

    const mark = document.createElement('mark')
    mark.dataset.highlightId = highlight.id
    mark.style.backgroundColor = HIGHLIGHT_BACKGROUND[highlight.color]
    mark.style.borderRadius = '2px'
    mark.style.cursor = 'pointer'
    mark.addEventListener('click', (event) => {
      event.stopPropagation()
      onClick(highlight.id)
    })
    range.surroundContents(mark)

    if (highlight.comment) {
      const indicator = document.createElement('span')
      indicator.textContent = ' \u{1F4AC}'
      indicator.title = 'Open comment'
      indicator.style.cursor = 'pointer'
      indicator.addEventListener('click', (event) => {
        event.stopPropagation()
        onClick(highlight.id)
      })
      mark.after(indicator)
    }
  }
}

export function renderHighlights(
  container: HTMLElement,
  pristineHtml: string,
  highlights: Highlight[],
  onHighlightClick: (highlightId: string) => void
): void {
  container.innerHTML = pristineHtml
  for (const highlight of highlights) {
    const { text, ranges } = buildNodeRanges(findTextNodes(container))
    const match = findBestMatch(text, highlight.anchor)
    if (!match) continue
    wrapMatch(ranges, match.start, match.end, highlight, onHighlightClick)
  }
}

export function computeAnchorFromSelection(
  container: HTMLElement,
  selection: Selection
): TextQuoteAnchor | null {
  if (selection.rangeCount === 0) return null
  const range = selection.getRangeAt(0)
  if (range.collapsed || !container.contains(range.commonAncestorContainer)) return null

  const { text, ranges } = buildNodeRanges(findTextNodes(container))
  const start = offsetOf(ranges, range.startContainer, range.startOffset)
  const end = offsetOf(ranges, range.endContainer, range.endOffset)
  if (start === null || end === null || end <= start) return null

  const CONTEXT_LENGTH = 32
  return {
    exact: text.slice(start, end),
    prefix: text.slice(Math.max(0, start - CONTEXT_LENGTH), start),
    suffix: text.slice(end, end + CONTEXT_LENGTH)
  }
}

function offsetOf(ranges: NodeRange[], node: Node, localOffset: number): number | null {
  const match = ranges.find((r) => r.node === node)
  return match ? match.start + localOffset : null
}
