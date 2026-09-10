import { create } from 'zustand'
import type { Analytics } from '@shared/types'

interface AnalyticsState {
  analytics: Analytics | null
  loading: boolean
  loadAnalytics: () => Promise<void>
}

export const useAnalyticsStore = create<AnalyticsState>((set) => ({
  analytics: null,
  loading: false,

  loadAnalytics: async () => {
    set({ loading: true })
    const analytics = await window.api.analytics.get()
    set({ analytics, loading: false })
  }
}))
