// Chat engine for the Read app's AI panel. Two modes:
//  - scope "article": the full article text is placed straight into the system
//    prompt — no search needed for a single document.
//  - scope "all": the model gets read-only search tools over the whole library
//    (keyword + semantic) and decides when to use them, same tool-calling
//    pattern as AgentDesk's Collections chat (src/bun/collections/chat.ts).

import { streamText, tool, isStepCount, type ModelMessage } from 'ai'
import { z } from 'zod'
import { getDb } from '../../db'
import { getArticleById, listArticles } from '../articles/repository'
import { createProviderAdapter, getStaticDefaultModel } from './providers'
import { getAiSettings, getDecryptedApiKey } from './settingsRepository'
import { embedText } from './embeddings/embedder'
import { unpackVector, rankBySimilarity, type VectorEntry } from './embeddings/similarity'
import { isEmbeddingModelDownloaded } from './embeddings/model-manager'
import { broadcastToRenderer } from './broadcast'
import type { AiProviderType, ChatCitation, ChatScope } from '@shared/types'

const TOP_K = 5
const MIN_SIMILARITY = 0.35
// Enough for most saved articles without blowing a cheap/free model's context window.
const MAX_ARTICLE_CHARS = 24_000

const sessionHistory = new Map<string, ModelMessage[]>()
const activeAborts = new Map<string, AbortController>()

// ---------------------------------------------------------------------------
// Provider resolution
// ---------------------------------------------------------------------------

async function resolveProviderAndModel(): Promise<{
  adapter: ReturnType<typeof createProviderAdapter>
  providerType: AiProviderType
  modelId: string
}> {
  const settings = getAiSettings()
  const apiKey = getDecryptedApiKey(settings.provider)
  const adapter = createProviderAdapter(settings.provider, apiKey, settings.model)

  let modelId = settings.model ?? getStaticDefaultModel(settings.provider)
  if (!modelId) {
    const { models } = await adapter.listModels()
    if (models.length === 0) {
      throw new Error(
        'No models are available from OpenCode right now. Check your connection and try again.'
      )
    }
    modelId = models[0]
  }
  return { adapter, providerType: settings.provider, modelId }
}

// ---------------------------------------------------------------------------
// System prompts
// ---------------------------------------------------------------------------

function buildArticleSystemPrompt(article: {
  title: string | null
  author: string | null
  contentText: string | null
}): string {
  const text = (article.contentText ?? '').slice(0, MAX_ARTICLE_CHARS)
  const truncatedNote =
    (article.contentText?.length ?? 0) > MAX_ARTICLE_CHARS
      ? '\n\n[Note: the article was truncated for length.]'
      : ''
  return `You are a reading assistant inside the Read! app. The user is reading the article below and wants to discuss it.

Title: ${article.title ?? 'Untitled'}
Author: ${article.author ?? 'Unknown'}

--- ARTICLE TEXT ---
${text}${truncatedNote}
--- END ARTICLE TEXT ---

Answer questions about this article, summarize it, explain parts of it simply, or pull out key takeaways as asked. Be concise and helpful. Base your answers only on the article text above — do not invent facts it does not contain.`
}

const ALL_ARTICLES_SYSTEM_PROMPT = `You are the Read! app's library assistant — a Q&A helper over the user's saved articles.

You can:
- Search titles/content for a keyword (\`search_articles\`)
- Search by meaning when there's no exact keyword match (\`semantic_search_articles\`, if available)
- Read one article's full text once you have its id (\`read_article\`)

Always search before answering a question about the user's articles — don't guess from general knowledge. Cite which articles you used by naming their titles naturally in your answer.

Be concise and helpful. If the user's message is short or ambiguous, search for it first rather than asking what they meant.`

// ---------------------------------------------------------------------------
// Tools (scope: "all" only)
// ---------------------------------------------------------------------------

interface ChunkRow {
  article_id: string
  chunk_text: string
  embedding: Uint8Array | null
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- inferred from tool()'s own generics
function createLibraryTools(citationSink: Map<string, ChatCitation>) {
  return {
    search_articles: tool({
      description:
        "Keyword search over the user's saved articles (title + content). Always available.",
      inputSchema: z.object({ query: z.string().describe('Search text') }),
      execute: async ({ query }) => {
        const results = listArticles({ query, status: 'all' }).slice(0, 10)
        for (const a of results)
          citationSink.set(a.id, { articleId: a.id, title: a.title ?? 'Untitled' })
        return JSON.stringify({
          results: results.map((a) => ({
            id: a.id,
            title: a.title,
            snippet: (a.contentText ?? '').slice(0, 300)
          })),
          count: results.length
        })
      }
    }),

    ...(isEmbeddingModelDownloaded()
      ? {
          semantic_search_articles: tool({
            description:
              'Meaning-based search over articles using embeddings — better than search_articles for fuzzy/conceptual queries.',
            inputSchema: z.object({ query: z.string().describe('Natural-language query') }),
            execute: async ({ query }) => {
              const db = getDb()
              const rows = db
                .prepare(
                  `SELECT article_id, chunk_text, embedding FROM article_chunks WHERE embedding IS NOT NULL`
                )
                .all() as unknown as ChunkRow[]
              if (rows.length === 0) {
                return JSON.stringify({ results: [], count: 0, note: 'No indexed articles yet.' })
              }

              const corpus: VectorEntry[] = rows.map((r, i) => ({
                id: String(i),
                vector: unpackVector(r.embedding as Uint8Array)
              }))
              const queryVector = await embedText(query)
              const topMatches = rankBySimilarity(queryVector, corpus, TOP_K * 2).filter(
                (m) => m.similarity >= MIN_SIMILARITY
              )

              const seenArticles = new Set<string>()
              const results: { id: string; title: string | null; snippet: string }[] = []
              for (const match of topMatches) {
                const row = rows[Number(match.id)]
                if (!row || seenArticles.has(row.article_id)) continue
                seenArticles.add(row.article_id)
                const article = getArticleById(row.article_id)
                if (!article) continue
                citationSink.set(article.id, {
                  articleId: article.id,
                  title: article.title ?? 'Untitled'
                })
                results.push({
                  id: article.id,
                  title: article.title,
                  snippet: row.chunk_text.slice(0, 300)
                })
                if (results.length >= TOP_K) break
              }

              return JSON.stringify({
                results,
                count: results.length,
                note:
                  results.length === 0
                    ? 'No sufficiently relevant articles found by meaning.'
                    : undefined
              })
            }
          })
        }
      : {}),

    read_article: tool({
      description: "Read an article's full text by id. Use an id from a prior search result.",
      inputSchema: z.object({
        article_id: z.string().describe("The article's id, from a prior search result")
      }),
      execute: async ({ article_id }) => {
        const article = getArticleById(article_id)
        if (!article) return JSON.stringify({ error: 'Article not found' })
        citationSink.set(article.id, { articleId: article.id, title: article.title ?? 'Untitled' })
        return JSON.stringify({
          id: article.id,
          title: article.title,
          author: article.author,
          contentText: (article.contentText ?? '').slice(0, MAX_ARTICLE_CHARS)
        })
      }
    })
  }
}

// ---------------------------------------------------------------------------
// Exported chat API
// ---------------------------------------------------------------------------

export async function sendChatMessage(params: {
  sessionId: string
  content: string
  scope: ChatScope
}): Promise<{ messageId: string }> {
  const { sessionId, content, scope } = params

  activeAborts.get(sessionId)?.abort()
  const messageId = crypto.randomUUID()
  const abortController = new AbortController()
  activeAborts.set(sessionId, abortController)

  const history = sessionHistory.get(sessionId) ?? []
  const newHistory: ModelMessage[] = [...history, { role: 'user', content }]
  sessionHistory.set(sessionId, newHistory)

  const citationSink = new Map<string, ChatCitation>()

  ;(async () => {
    let fullText = ''
    try {
      const { adapter, modelId } = await resolveProviderAndModel()
      const model = adapter.createModel(modelId)

      let systemPrompt: string
      let tools: ReturnType<typeof createLibraryTools> | undefined
      if (scope.type === 'article') {
        const article = getArticleById(scope.articleId)
        if (!article) throw new Error('Article not found.')
        systemPrompt = buildArticleSystemPrompt(article)
        citationSink.set(article.id, { articleId: article.id, title: article.title ?? 'Untitled' })
      } else {
        systemPrompt = ALL_ARTICLES_SYSTEM_PROMPT
        tools = createLibraryTools(citationSink)
      }

      const result = streamText({
        model,
        instructions: systemPrompt,
        messages: newHistory,
        tools,
        stopWhen: [isStepCount(8)],
        abortSignal: AbortSignal.any([abortController.signal, AbortSignal.timeout(180_000)])
      })

      for await (const part of result.stream) {
        if (part.type === 'text-delta') {
          const text = (part as { text?: string }).text ?? ''
          fullText += text
          broadcastToRenderer('ai:chatChunk', { sessionId, messageId, token: text })
        } else if (part.type === 'error') {
          const err = (part as { error: unknown }).error
          throw err instanceof Error ? err : new Error(String(err))
        }
      }

      if (!fullText.trim()) {
        throw new Error(
          'The AI model returned an empty response. Check your provider setup or try a different model.'
        )
      }

      const updatedHistory = sessionHistory.get(sessionId) ?? newHistory
      sessionHistory.set(sessionId, [...updatedHistory, { role: 'assistant', content: fullText }])

      broadcastToRenderer('ai:chatComplete', {
        sessionId,
        messageId,
        content: fullText,
        citations: [...citationSink.values()]
      })
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return
      if (err instanceof Error && err.name === 'AbortError') return
      const message = err instanceof Error ? err.message : String(err)
      broadcastToRenderer('ai:chatError', { sessionId, error: message })
    } finally {
      activeAborts.delete(sessionId)
    }
  })()

  return { messageId }
}

export function abortChatMessage(sessionId: string): { success: boolean } {
  const ctrl = activeAborts.get(sessionId)
  if (!ctrl) return { success: false }
  ctrl.abort()
  activeAborts.delete(sessionId)
  return { success: true }
}

export function clearChatSession(sessionId: string): { success: boolean } {
  sessionHistory.delete(sessionId)
  activeAborts.get(sessionId)?.abort()
  activeAborts.delete(sessionId)
  return { success: true }
}
