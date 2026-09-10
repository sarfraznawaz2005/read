import { createCategory, deleteCategory, listCategories, renameCategory } from './repository'
import type { Category } from '@shared/types'

export const categoryHandlers = {
  'category:list': (): Category[] => listCategories(),
  'category:create': (_event: unknown, name: string): Category => createCategory(name),
  'category:rename': (_event: unknown, id: string, name: string): Category =>
    renameCategory(id, name),
  'category:delete': (_event: unknown, id: string, reassignToId?: string): void =>
    deleteCategory(id, reassignToId)
}
