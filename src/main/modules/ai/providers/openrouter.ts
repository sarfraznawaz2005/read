import { createOpenAICompatible } from '@ai-sdk/openai-compatible'
import { generateText } from 'ai'
import type { LanguageModel } from 'ai'
import type { ModelListResult, ProviderAdapter, ProviderConfig } from './types'

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1'
// Public catalog endpoint — no API key required to list it, so this is fetched
// live on every call rather than kept as a hand-maintained list (OpenRouter
// ships new/renamed models constantly).
const OPENROUTER_MODELS_URL = 'https://openrouter.ai/api/v1/models'

// Last resort only, used when the live catalog fetch fails — a small known-good
// subset rather than OpenRouter's full catalog.
const FALLBACK_MODELS = [
  'anthropic/claude-sonnet-4-5',
  'anthropic/claude-opus-4-5',
  'anthropic/claude-haiku-4-5',
  'openai/gpt-4o',
  'openai/gpt-4o-mini',
  'openai/o3',
  'google/gemini-2.5-pro-preview',
  'google/gemini-2.0-flash-001',
  'meta-llama/llama-3.3-70b-instruct',
  'mistralai/mistral-large-2411',
  'x-ai/grok-3'
]

export const OPENROUTER_DEFAULT_MODEL = 'anthropic/claude-sonnet-4-5'

export class OpenRouterAdapter implements ProviderAdapter {
  private config: ProviderConfig
  private provider: ReturnType<typeof createOpenAICompatible>

  constructor(config: ProviderConfig) {
    this.config = config
    this.provider = createOpenAICompatible({
      name: 'openrouter',
      apiKey: config.apiKey,
      baseURL: OPENROUTER_BASE_URL,
      includeUsage: true
    })
  }

  createModel(modelId: string): LanguageModel {
    return this.provider(modelId)
  }

  async listModels(): Promise<ModelListResult> {
    try {
      const response = await fetch(OPENROUTER_MODELS_URL, { signal: AbortSignal.timeout(10_000) })
      if (!response.ok) {
        console.error(`[openrouter] listModels HTTP ${response.status}`)
        return {
          models: FALLBACK_MODELS,
          isFallback: true,
          fallbackReason: `OpenRouter returned an error (HTTP ${response.status}) — showing a default list that may be out of date.`
        }
      }
      const data = (await response.json()) as { data?: Array<{ id: string }> }
      const models = (data.data ?? []).map((m) => m.id).sort()
      if (models.length === 0) {
        return {
          models: FALLBACK_MODELS,
          isFallback: true,
          fallbackReason: 'OpenRouter returned an empty catalog — showing a default list.'
        }
      }
      return { models, isFallback: false }
    } catch (err) {
      console.error('[openrouter] listModels failed:', err)
      return {
        models: FALLBACK_MODELS,
        isFallback: true,
        fallbackReason:
          (err instanceof Error ? err.message : 'Could not reach OpenRouter.') +
          ' — showing a default list that may be out of date.'
      }
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const modelId = this.config.defaultModel ?? OPENROUTER_DEFAULT_MODEL
      await generateText({
        model: this.createModel(modelId),
        prompt: 'Hi',
        maxOutputTokens: 5,
        abortSignal: AbortSignal.timeout(15_000)
      })
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  }
}
