import { createProviderAdapter } from './providers'
import { getAiSettings, updateAiSettings, getDecryptedApiKey } from './settingsRepository'
import { sendChatMessage, abortChatMessage, clearChatSession } from './chat'
import {
  getEmbeddingModelStatus,
  downloadEmbeddingModel,
  isEmbeddingModelDownloaded
} from './embeddings/model-manager'
import { reindexAll } from './embeddings/indexer'
import type {
  AiProviderType,
  AiSettings,
  AiSettingsPatch,
  ChatScope,
  EmbeddingModelStatusDto,
  ModelListResult
} from '@shared/types'

export const aiHandlers = {
  'ai:getSettings': (): AiSettings => getAiSettings(),
  'ai:updateSettings': (_e: unknown, patch: AiSettingsPatch): AiSettings => updateAiSettings(patch),

  'ai:listModels': (
    _e: unknown,
    provider: AiProviderType,
    apiKey?: string
  ): Promise<ModelListResult> => {
    const key = apiKey ?? getDecryptedApiKey(provider)
    return createProviderAdapter(provider, key, null).listModels()
  },

  'ai:testConnection': (
    _e: unknown,
    provider: AiProviderType,
    apiKey: string | undefined,
    model: string | null
  ): Promise<{ success: boolean; error?: string }> => {
    const key = apiKey ?? getDecryptedApiKey(provider)
    return createProviderAdapter(provider, key, model).testConnection()
  },

  'ai:embeddingModel:getStatus': (): EmbeddingModelStatusDto => getEmbeddingModelStatus(),
  'ai:embeddingModel:isReady': (): boolean => isEmbeddingModelDownloaded(),
  'ai:embeddingModel:download': (): Promise<{ success: boolean }> => downloadEmbeddingModel(),
  'ai:embeddingModel:reindexAll': (): Promise<{ success: boolean; indexed: number }> =>
    reindexAll(),

  'ai:chat:send': (
    _e: unknown,
    params: { sessionId: string; content: string; scope: ChatScope }
  ): Promise<{ messageId: string }> => sendChatMessage(params),
  'ai:chat:abort': (_e: unknown, sessionId: string): { success: boolean } =>
    abortChatMessage(sessionId),
  'ai:chat:clear': (_e: unknown, sessionId: string): { success: boolean } =>
    clearChatSession(sessionId)
}
