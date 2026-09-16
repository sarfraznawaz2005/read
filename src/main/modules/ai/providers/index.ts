import type { AiProviderType } from '@shared/types'
import type { ProviderAdapter } from './types'
import { GoogleAdapter, GEMINI_DEFAULT_MODEL } from './google'
import { OpenRouterAdapter, OPENROUTER_DEFAULT_MODEL } from './openrouter'
import { OpenCodeAdapter } from './opencode'

export function createProviderAdapter(
  providerType: AiProviderType,
  apiKey: string,
  defaultModel: string | null
): ProviderAdapter {
  switch (providerType) {
    case 'gemini':
      return new GoogleAdapter({ apiKey, defaultModel })
    case 'openrouter':
      return new OpenRouterAdapter({ apiKey, defaultModel })
    case 'opencode':
      // No key required — "public" unlocks OpenCode's free-model tier.
      return new OpenCodeAdapter({ apiKey: apiKey || 'public', defaultModel })
  }
}

// Only a fixed fallback for providers with a stable default id. OpenCode has none —
// its free catalog changes, so callers fall back to listModels()[0] instead.
export function getStaticDefaultModel(providerType: AiProviderType): string | null {
  switch (providerType) {
    case 'gemini':
      return GEMINI_DEFAULT_MODEL
    case 'openrouter':
      return OPENROUTER_DEFAULT_MODEL
    case 'opencode':
      return null
  }
}
