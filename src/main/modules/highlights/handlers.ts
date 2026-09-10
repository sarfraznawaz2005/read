import {
  deleteComment,
  deleteHighlight,
  insertHighlight,
  listHighlightsByArticle,
  updateHighlightColor,
  upsertComment
} from './repository'
import type { Highlight, HighlightColor, TextQuoteAnchor } from '@shared/types'

export const highlightHandlers = {
  'highlight:listByArticle': (_event: unknown, articleId: string): Highlight[] =>
    listHighlightsByArticle(articleId),
  'highlight:add': (
    _event: unknown,
    articleId: string,
    anchor: TextQuoteAnchor,
    color: HighlightColor,
    selectedText: string
  ): Highlight => insertHighlight(articleId, color, anchor, selectedText),
  'highlight:update': (_event: unknown, id: string, color: HighlightColor): Highlight =>
    updateHighlightColor(id, color),
  'highlight:delete': (_event: unknown, id: string): void => deleteHighlight(id),
  'comment:upsert': (_event: unknown, highlightId: string, text: string): Highlight =>
    upsertComment(highlightId, text),
  'comment:delete': (_event: unknown, highlightId: string): Highlight => deleteComment(highlightId)
}
