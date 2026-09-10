import {
  createCategory,
  deleteCategory,
  getCategoryByName,
  listCategories,
  renameCategory
} from './repository'
import type { Category } from '@shared/types'

export const categoryHandlers = {
  'category:list': (): Category[] => listCategories(),
  'category:create': (_event: unknown, name: string): Category => {
    const trimmed = name.trim()
    if (getCategoryByName(trimmed)) {
      throw new Error(`A category named "${trimmed}" already exists.`)
    }
    return createCategory(trimmed)
  },
  'category:rename': (_event: unknown, id: string, name: string): Category => {
    const trimmed = name.trim()
    if (getCategoryByName(trimmed, id)) {
      throw new Error(`A category named "${trimmed}" already exists.`)
    }
    return renameCategory(id, trimmed)
  },
  'category:delete': (_event: unknown, id: string, reassignToId?: string): void =>
    deleteCategory(id, reassignToId)
}
