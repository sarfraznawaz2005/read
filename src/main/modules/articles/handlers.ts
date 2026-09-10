import { extractArticle } from '../../extraction'
import { getDefaultCategoryId } from '../categories/repository'
import {
  deleteArticle,
  getArticleById,
  getArticleByUrl,
  insertPendingArticle,
  listArticles,
  markArticleOpened,
  saveExtractionFailure,
  saveExtractionResult,
  updateArticleStatus
} from './repository'
import type { Article, ArticleListFilter, ArticleStatusPatch } from '@shared/types'

export async function runExtraction(articleId: string, url: string): Promise<Article> {
  try {
    const result = await extractArticle(url)
    return saveExtractionResult(articleId, result)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown extraction error'
    return saveExtractionFailure(articleId, message)
  }
}

export const articleHandlers = {
  'article:add': async (_event: unknown, url: string, categoryId?: string): Promise<Article> => {
    const trimmed = url.trim()
    if (getArticleByUrl(trimmed)) {
      throw new Error('This link has already been saved.')
    }
    const pending = insertPendingArticle(trimmed, categoryId ?? getDefaultCategoryId())
    return runExtraction(pending.id, trimmed)
  },
  'article:retryExtraction': async (_event: unknown, articleId: string): Promise<Article> => {
    const article = getArticleById(articleId)
    if (!article) throw new Error(`Article ${articleId} not found`)
    return runExtraction(articleId, article.url)
  },
  'article:list': (_event: unknown, filter: ArticleListFilter = {}): Article[] =>
    listArticles(filter),
  'article:markOpened': (_event: unknown, articleId: string): Article =>
    markArticleOpened(articleId),
  'article:delete': (_event: unknown, articleId: string): void => deleteArticle(articleId),
  'article:updateStatus': (
    _event: unknown,
    articleId: string,
    patch: ArticleStatusPatch
  ): Article => updateArticleStatus(articleId, patch)
}
