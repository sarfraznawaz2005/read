// Splits a long article into overlapping word-count chunks for embedding. A
// single article is too long to embed as one vector meaningfully, unlike
// AgentDesk's short Collections notes — this is the one real difference from
// that feature's indexing pipeline.
const CHUNK_WORD_SIZE = 220
const CHUNK_OVERLAP_WORDS = 40

export function chunkArticleText(title: string, contentText: string): string[] {
  const words = `${title}\n\n${contentText}`.split(/\s+/).filter(Boolean)
  if (words.length === 0) return []

  const chunks: string[] = []
  let start = 0
  while (start < words.length) {
    const end = Math.min(start + CHUNK_WORD_SIZE, words.length)
    chunks.push(words.slice(start, end).join(' '))
    if (end >= words.length) break
    start = end - CHUNK_OVERLAP_WORDS
  }
  return chunks
}
