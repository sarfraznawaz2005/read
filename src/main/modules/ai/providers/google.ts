import { createGoogle } from '@ai-sdk/google'
import { generateText } from 'ai'
import type { LanguageModel } from 'ai'
import type { ModelListResult, ProviderAdapter, ProviderConfig } from './types'

// Last resort only — shown with a visible warning when the live fetch below
// fails, never silently. Google deprecates/renames models faster than this
// list can be kept current by hand (see google.ts's listModels for the fix).
const FALLBACK_MODELS = [
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-pro',
  'gemini-1.5-flash'
]

export const GEMINI_DEFAULT_MODEL = 'gemini-2.5-flash'

export class GoogleAdapter implements ProviderAdapter {
  private config: ProviderConfig
  private provider: ReturnType<typeof createGoogle>

  constructor(config: ProviderConfig) {
    this.config = config
    this.provider = createGoogle({ apiKey: config.apiKey })
  }

  createModel(modelId: string): LanguageModel {
    return this.provider(modelId)
  }

  async listModels(): Promise<ModelListResult> {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models?key=${this.config.apiKey}`,
        { signal: AbortSignal.timeout(10_000) }
      )
      if (!response.ok) {
        const body = await response.text().catch(() => '')
        console.error(`[gemini] listModels HTTP ${response.status}: ${body.slice(0, 300)}`)
        return {
          models: FALLBACK_MODELS,
          isFallback: true,
          fallbackReason:
            response.status === 400 || response.status === 403
              ? 'Could not verify your Gemini API key — showing a default list that may be out of date.'
              : `Google returned an error (HTTP ${response.status}) — showing a default list that may be out of date.`
        }
      }
      const data = (await response.json()) as {
        models?: Array<{ name: string; supportedGenerationMethods?: string[] }>
      }
      const models = (data.models ?? [])
        .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
        .map((m) => m.name.replace('models/', ''))
        .filter((id) => id.startsWith('gemini'))
        .sort()
      if (models.length === 0) {
        return {
          models: FALLBACK_MODELS,
          isFallback: true,
          fallbackReason: 'Google returned no Gemini models for this key — showing a default list.'
        }
      }
      return { models, isFallback: false }
    } catch (err) {
      console.error('[gemini] listModels failed:', err)
      return {
        models: FALLBACK_MODELS,
        isFallback: true,
        fallbackReason:
          (err instanceof Error ? err.message : 'Could not reach Google.') +
          ' — showing a default list that may be out of date.'
      }
    }
  }

  async testConnection(): Promise<{ success: boolean; error?: string }> {
    try {
      const modelId = this.config.defaultModel ?? GEMINI_DEFAULT_MODEL
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
