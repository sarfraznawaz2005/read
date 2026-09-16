import type { LanguageModel } from 'ai'
import type { ModelListResult } from '@shared/types'

export type { ModelListResult }

export interface ProviderConfig {
  apiKey: string
  defaultModel: string | null
}

export interface ProviderAdapter {
  createModel(modelId: string): LanguageModel
  listModels(): Promise<ModelListResult>
  testConnection(): Promise<{ success: boolean; error?: string }>
}
