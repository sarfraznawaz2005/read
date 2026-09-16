import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { generateText } from 'ai'
import type { LanguageModel } from 'ai'
import type { ModelListResult, ProviderAdapter, ProviderConfig } from './types'

const OPENCODE_BASE_URL = 'https://opencode.ai/zen/v1'
const MODELS_DEV_URL = 'https://models.dev/api.json'
const CACHE_TTL_MS = 5 * 60 * 1000

// The Zen backend classifies requests without these headers as anonymous and
// applies a much lower rate-limit quota — see AgentDesk's opencode.ts for the
// same fix, which this is ported from.
function buildOpenCodeHeaders(sessionId: string): Record<string, string> {
  return {
    'x-opencode-client': 'cli',
    'x-opencode-session': sessionId,
    'x-opencode-project': 'global',
    'x-opencode-request': `msg_${crypto.randomUUID()}`
  }
}

function createOpenCodeFetch(sessionId: string): typeof globalThis.fetch {
  const openCodeFetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url
    if (!url.startsWith(OPENCODE_BASE_URL)) {
      return globalThis.fetch(input, init)
    }
    const existingHeaders = new Headers(init?.headers)
    for (const [key, value] of Object.entries(buildOpenCodeHeaders(sessionId))) {
      existingHeaders.set(key, value)
    }
    return globalThis.fetch(input, { ...init, headers: existingHeaders })
  }
  return openCodeFetch as typeof globalThis.fetch
}

let modelsCache: { models: string[]; ts: number } | null = null

async function fetchFreeModels(extraHeaders?: Record<string, string>): Promise<string[]> {
  const API_TIMEOUT_MS = 30_000
  const CATALOG_TIMEOUT_MS = 10_000

  const apiPromise = fetch(`${OPENCODE_BASE_URL}/models`, {
    headers: { Authorization: 'Bearer public', ...extraHeaders },
    signal: AbortSignal.timeout(API_TIMEOUT_MS)
  })
    .then(async (res) => {
      if (!res.ok) return null
      const data = (await res.json()) as { data?: Array<{ id: string }> }
      return data.data?.map((m) => m.id) ?? []
    })
    .catch(() => null)

  const catalogPromise = fetch(MODELS_DEV_URL, { signal: AbortSignal.timeout(CATALOG_TIMEOUT_MS) })
    .then(async (res) => {
      if (!res.ok) return null
      const catalog = (await res.json()) as Record<string, unknown>
      const provider = catalog['opencode'] as Record<string, unknown> | undefined
      if (!provider?.models) return null
      return new Set(
        Object.entries(provider.models as Record<string, unknown>)
          .filter(([, m]) => (m as { cost?: { input?: number } })?.cost?.input === 0)
          .map(([id]) => id)
      )
    })
    .catch(() => null)

  const [availableFromApi, freeFromCatalog] = await Promise.all([apiPromise, catalogPromise])

  if (availableFromApi && freeFromCatalog) {
    return availableFromApi.filter((id) => freeFromCatalog.has(id))
  }
  if (availableFromApi) return availableFromApi
  if (freeFromCatalog) return [...freeFromCatalog]
  return []
}

export class OpenCodeAdapter implements ProviderAdapter {
  private provider: ReturnType<typeof createOpenAICompatible>
  private apiKey: string
  private sessionId: string
  private defaultModel: string | null

  constructor(config: ProviderConfig) {
    this.apiKey = config.apiKey && config.apiKey !== 'public' ? config.apiKey : 'public'
    this.defaultModel = config.defaultModel ?? null
    this.sessionId = `ses_${crypto.randomUUID()}`
    this.provider = createOpenAICompatible({
      name: 'opencode',
      apiKey: this.apiKey,
      baseURL: OPENCODE_BASE_URL,
      fetch: createOpenCodeFetch(this.sessionId),
      includeUsage: true
    })
  }

  createModel(modelId: string): LanguageModel {
    return this.provider(modelId)
  }

  async listModels(): Promise<ModelListResult> {
    const now = Date.now()
    if (modelsCache && now - modelsCache.ts < CACHE_TTL_MS) {
      return { models: modelsCache.models, isFallback: false }
    }
    const models = await fetchFreeModels(
      this.apiKey === 'public' ? buildOpenCodeHeaders(this.sessionId) : undefined
    )
    if (models.length > 0) {
      modelsCache = { models, ts: now }
      return { models, isFallback: false }
    }
    return {
      models: [],
      isFallback: true,
      fallbackReason: 'Could not reach OpenCode — check your connection and try again.'
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const { models } = await this.listModels()
      if (models.length === 0) {
        return {
          success: false,
          error: 'No free models available from OpenCode. Check your connection and try again.'
        }
      }
      const modelId = this.defaultModel ?? models[0]
      await generateText({
        model: this.createModel(modelId),
        prompt: 'Hi',
        maxOutputTokens: 5,
        abortSignal: AbortSignal.timeout(30_000)
      })
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
}
