import { getAnalytics } from './repository'
import type { Analytics } from '@shared/types'

export const analyticsHandlers = {
  'analytics:get': (): Analytics => getAnalytics()
}
