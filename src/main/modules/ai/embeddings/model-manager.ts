// Download/verify/status lifecycle for the local embedding model. Ported from
// AgentDesk's Collections feature (src/bun/collections/embeddings/model-manager.ts),
// adapted from Bun+Drizzle to Electron+node:sqlite.
//
// @huggingface/transformers (and its native onnxruntime dependency) is imported
// dynamically inside runDownload()/configureEmbeddingModelEnv(), never at module
// top level, so the native binding only loads once the user actually opens chat.

import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync, readdirSync } from 'node:fs'
import { join, sep } from 'node:path'
import { app } from 'electron'
import type { ProgressInfo } from '@huggingface/transformers'
import { getDb } from '../../../db'
import { broadcastToRenderer } from '../broadcast'
import type { EmbeddingModelStatus, EmbeddingModelStatusDto } from '@shared/types'

export const EMBEDDING_MODEL_ID = 'sentence-transformers/all-MiniLM-L6-v2'
export const EMBEDDING_MODEL_DIMS = 384
const APPROX_DOWNLOAD_SIZE_MB = 90

export function embeddingModelDir(): string {
  return join(app.getPath('userData'), 'ai', 'embed-model')
}

function markerPath(): string {
  return join(embeddingModelDir(), '.ready.json')
}

export async function configureEmbeddingModelEnv(): Promise<void> {
  const { env } = await import('@huggingface/transformers')
  const dir = embeddingModelDir()
  env.cacheDir = dir.endsWith(sep) ? dir : dir + sep
}

export function isEmbeddingModelDownloaded(): boolean {
  return readMarker() !== null
}

interface ReadyMarker {
  modelId: string
  dims: number
  downloadedAt: string
}

let activeDownloadProgress: number | null = null
let lastError: string | null = null
let inFlightDownload: Promise<{ success: boolean }> | null = null

function readMarker(): ReadyMarker | null {
  try {
    if (!existsSync(markerPath())) return null
    return JSON.parse(readFileSync(markerPath(), 'utf-8')) as ReadyMarker
  } catch {
    return null
  }
}

function directorySizeBytes(dir: string): number {
  if (!existsSync(dir)) return 0
  let total = 0
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name)
    total += entry.isDirectory() ? directorySizeBytes(full) : statSync(full).size
  }
  return total
}

function currentStatus(): EmbeddingModelStatus {
  if (activeDownloadProgress !== null) return 'downloading'
  if (readMarker()) return 'ready'
  if (lastError) return 'error'
  return 'not_downloaded'
}

export function getEmbeddingModelStatus(): EmbeddingModelStatusDto {
  const status = currentStatus()
  const sizeMb =
    status === 'ready'
      ? Math.round(directorySizeBytes(embeddingModelDir()) / (1024 * 1024))
      : APPROX_DOWNLOAD_SIZE_MB

  const db = getDb()
  const totalRow = db
    .prepare('SELECT COUNT(DISTINCT article_id) AS n FROM article_chunks')
    .get() as {
    n: number
  }
  const indexedRow = db
    .prepare(
      'SELECT COUNT(DISTINCT article_id) AS n FROM article_chunks WHERE embedding IS NOT NULL'
    )
    .get() as { n: number }
  const totalArticlesRow = db
    .prepare(`SELECT COUNT(*) AS n FROM articles WHERE extraction_status = 'ok'`)
    .get() as { n: number }

  return {
    status,
    progress: status === 'downloading' ? activeDownloadProgress : null,
    message: status === 'error' ? (lastError ?? undefined) : undefined,
    sizeMb,
    indexedArticles: indexedRow?.n ?? 0,
    totalArticles: Math.max(totalRow?.n ?? 0, totalArticlesRow?.n ?? 0)
  }
}

export async function downloadEmbeddingModel(): Promise<{ success: boolean }> {
  if (inFlightDownload) return inFlightDownload
  inFlightDownload = runDownload().finally(() => {
    inFlightDownload = null
  })
  return inFlightDownload
}

async function runDownload(): Promise<{ success: boolean }> {
  activeDownloadProgress = 0
  lastError = null
  broadcastToRenderer('ai:embeddingModelStatus', {
    status: 'downloading',
    progress: 0,
    message: 'Starting download…'
  })

  try {
    mkdirSync(embeddingModelDir(), { recursive: true })
    const { pipeline, env } = await import('@huggingface/transformers')
    await configureEmbeddingModelEnv()
    env.allowRemoteModels = true

    const extractor = await pipeline('feature-extraction', EMBEDDING_MODEL_ID, {
      progress_callback: (info: ProgressInfo) => {
        if (info.status !== 'progress_total') return
        const progress = Math.round(info.progress)
        activeDownloadProgress = progress
        broadcastToRenderer('ai:embeddingModelStatus', {
          status: 'downloading',
          progress,
          message: `Downloading model… ${progress}%`
        })
      }
    })

    const output = await extractor('Read app embedding model verification', {
      pooling: 'mean',
      normalize: true
    })
    const dims = (output.data as Float32Array).length
    if (dims !== EMBEDDING_MODEL_DIMS) {
      throw new Error(`Expected a ${EMBEDDING_MODEL_DIMS}-dim embedding, got ${dims}`)
    }
    await extractor.model.dispose()

    const marker: ReadyMarker = {
      modelId: EMBEDDING_MODEL_ID,
      dims: EMBEDDING_MODEL_DIMS,
      downloadedAt: new Date().toISOString()
    }
    writeFileSync(markerPath(), JSON.stringify(marker, null, 2))

    activeDownloadProgress = null
    broadcastToRenderer('ai:embeddingModelStatus', {
      status: 'ready',
      progress: 100,
      message: 'Ready'
    })
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    activeDownloadProgress = null
    lastError = message
    broadcastToRenderer('ai:embeddingModelStatus', { status: 'error', message })
    return { success: false }
  }
}
