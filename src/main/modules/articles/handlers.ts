import { extractArticle } from '../../extraction'
import { getDefaultCategoryId } from '../categories/repository'
import {
  deleteArticle,
  getArticleById,
  getArticleByUrl,
  getArticleCounts,
  insertPendingArticle,
  listArticles,
  markArticleOpened,
  normalizeArticleUrl,
  saveExtractionFailure,
  saveExtractionResult,
  updateArticleStatus
} from './repository'
import type { Article, ArticleCounts, ArticleListFilter, ArticleStatusPatch } from '@shared/types'

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
    const normalized = normalizeArticleUrl(url)
    if (getArticleByUrl(normalized)) {
      throw new Error('This link has already been saved.')
    }
    const pending = insertPendingArticle(normalized, categoryId ?? getDefaultCategoryId())
    return runExtraction(pending.id, normalized)
  },
  'article:retryExtraction': async (_event: unknown, articleId: string): Promise<Article> => {
    const article = getArticleById(articleId)
    if (!article) throw new Error(`Article ${articleId} not found`)
    return runExtraction(articleId, article.url)
  },
  'article:list': (_event: unknown, filter: ArticleListFilter = {}): Article[] =>
    listArticles(filter),
  'article:counts': (): ArticleCounts => getArticleCounts(),
  'article:markOpened': (_event: unknown, articleId: string): Article =>
    markArticleOpened(articleId),
  'article:delete': (_event: unknown, articleId: string): void => deleteArticle(articleId),
  'article:updateStatus': (
    _event: unknown,
    articleId: string,
    patch: ArticleStatusPatch
  ): Article => updateArticleStatus(articleId, patch)
}
