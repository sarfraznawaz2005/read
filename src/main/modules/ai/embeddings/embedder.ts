// Generates embeddings using the model downloaded by model-manager.ts. Never
// fetches over the network — callers must check isEmbeddingModelDownloaded() first.

import type { FeatureExtractionPipeline } from '@huggingface/transformers'
import {
  EMBEDDING_MODEL_ID,
  EMBEDDING_MODEL_DIMS,
  configureEmbeddingModelEnv,
  isEmbeddingModelDownloaded
} from './model-manager'

let cachedExtractor: FeatureExtractionPipeline | null = null
let loadingPromise: Promise<FeatureExtractionPipeline> | null = null

async function getExtractor(): Promise<FeatureExtractionPipeline> {
  if (cachedExtractor) return cachedExtractor
  if (!loadingPromise) {
    loadingPromise = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers')
      await configureEmbeddingModelEnv()
      env.allowRemoteModels = false
      const extractor = await pipeline('feature-extraction', EMBEDDING_MODEL_ID)
      cachedExtractor = extractor
      return extractor
    })().finally(() => {
      loadingPromise = null
    })
  }
  return loadingPromise
}

export async function embedText(text: string): Promise<Float32Array> {
  if (!isEmbeddingModelDownloaded()) {
    throw new Error('Embedding model is not downloaded yet — download it from Chat settings first.')
  }
  const extractor = await getExtractor()
  const output = await extractor(text, { pooling: 'mean', normalize: true })
  const data = output.data as Float32Array
  if (data.length !== EMBEDDING_MODEL_DIMS) {
    throw new Error(`Expected a ${EMBEDDING_MODEL_DIMS}-dim embedding, got ${data.length}`)
  }
  return data
}
