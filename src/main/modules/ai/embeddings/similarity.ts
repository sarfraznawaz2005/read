// Pack/unpack embeddings for the article_chunks.embedding BLOB column, plus
// brute-force cosine similarity search. Ported from AgentDesk's Collections
// feature (src/bun/collections/embeddings/similarity.ts).

export function packVector(vec: Float32Array): Buffer {
  const buf = Buffer.allocUnsafe(vec.length * 4)
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  for (let i = 0; i < vec.length; i++) {
    view.setFloat32(i * 4, vec[i] ?? 0, true)
  }
  return buf
}

export function unpackVector(buf: Uint8Array): Float32Array {
  if (buf.byteLength % 4 !== 0) {
    throw new Error(`unpackVector: buffer length ${buf.byteLength} is not a multiple of 4 bytes`)
  }
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  const out = new Float32Array(buf.byteLength / 4)
  for (let i = 0; i < out.length; i++) {
    out[i] = view.getFloat32(i * 4, true)
  }
  return out
}

export function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  if (a.length !== b.length) {
    throw new Error('cosineSimilarity: vectors must have equal length')
  }
  let dot = 0
  let normA = 0
  let normB = 0
  for (let i = 0; i < a.length; i++) {
    const x = a[i] ?? 0
    const y = b[i] ?? 0
    dot += x * y
    normA += x * x
    normB += y * y
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB)
  return denom === 0 ? 0 : dot / denom
}

export interface VectorEntry {
  id: string
  vector: Float32Array
}

export interface RankedMatch {
  id: string
  similarity: number
}

export function rankBySimilarity(
  query: Float32Array,
  corpus: readonly VectorEntry[],
  limit?: number
): RankedMatch[] {
  const ranked: RankedMatch[] = []
  for (const entry of corpus) {
    if (entry.vector.length !== query.length) continue
    ranked.push({ id: entry.id, similarity: cosineSimilarity(query, entry.vector) })
  }
  ranked.sort((a, b) => b.similarity - a.similarity)
  return limit !== undefined ? ranked.slice(0, limit) : ranked
}
