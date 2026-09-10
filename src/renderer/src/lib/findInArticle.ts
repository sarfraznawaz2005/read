import { buildNodeRanges, findTextNodes, type NodeRange } from './highlightDom'

export interface FindMatch {
  start: number
  end: number
}

export function findAllMatches(container: HTMLElement, query: string): FindMatch[] {
  if (!query.trim()) return []
  const { text } = buildNodeRanges(findTextNodes(container))
  const lowerText = text.toLowerCase()
  const lowerQuery = query.toLowerCase()
  const matches: FindMatch[] = []
  let index = lowerText.indexOf(lowerQuery)
  while (index !== -1) {
    matches.push({ start: index, end: index + query.length })
    index = lowerText.indexOf(lowerQuery, index + 1)
  }
  return matches
}

export function applyFindHighlight(
  container: HTMLElement,
  matches: FindMatch[],
  activeIndex: number
): void {
  clearFindMatches(container)
  matches.forEach((match, i) => {
    const { ranges } = buildNodeRanges(findTextNodes(container))
    wrapFindMatch(ranges, match.start, match.end, i === activeIndex)
  })
}

export function clearFindMatches(container: HTMLElement): void {
  const spans = container.querySelectorAll('span[data-find-match]')
  spans.forEach((span) => {
    const parent = span.parentNode
    if (!parent) return
    while (span.firstChild) parent.insertBefore(span.firstChild, span)
    parent.removeChild(span)
    parent.normalize()
  })
}

function wrapFindMatch(ranges: NodeRange[], start: number, end: number, active: boolean): void {
  for (const { node, start: nodeStart, end: nodeEnd } of ranges) {
    if (nodeEnd <= start || nodeStart >= end) continue
    const localStart = Math.max(0, start - nodeStart)
    const localEnd = Math.min(node.data.length, end - nodeStart)
    if (localStart >= localEnd) continue

    const range = document.createRange()
    range.setStart(node, localStart)
    range.setEnd(node, localEnd)

    const span = document.createElement('span')
    span.dataset.findMatch = 'true'
    span.style.borderRadius = '2px'
    span.style.backgroundColor = active ? '#f97316' : '#fde68a'
    span.style.color = active ? '#ffffff' : '#1e293b'
    range.surroundContents(span)

    if (active) span.scrollIntoView({ block: 'center', behavior: 'smooth' })
  }
}
