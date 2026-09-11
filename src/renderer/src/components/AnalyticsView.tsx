import { useEffect } from 'react'
import { ArrowLeft, Flame } from 'lucide-react'
import { useAnalyticsStore } from '../store/analyticsStore'

function weekdayLabel(dateStr: string): string {
  return new Date(`${dateStr}T00:00:00Z`).toLocaleDateString('en-US', {
    weekday: 'short',
    timeZone: 'UTC'
  })
}

export function AnalyticsView({ onBack }: { onBack: () => void }): React.JSX.Element {
  const { analytics, loadAnalytics } = useAnalyticsStore()

  useEffect(() => {
    void loadAnalytics()
  }, [loadAnalytics])

  if (!analytics) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-white text-slate-400 dark:bg-slate-900">
        Loading analytics…
      </div>
    )
  }

  const weeklyDays = analytics.perDay.slice(-7)
  const maxWeeklyCount = Math.max(1, ...weeklyDays.map((d) => d.count))
  const readingHours = (analytics.estReadingTimeMinutes / 60).toFixed(1)
  const avgMinutesPerDay =
    analytics.perDay.length > 0
      ? Math.round(analytics.estReadingTimeMinutes / analytics.perDay.length)
      : 0

  return (
    <div className="flex h-screen w-screen flex-col overflow-hidden bg-white text-slate-800 dark:bg-slate-900 dark:text-slate-200">
      <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-6 py-4 dark:border-slate-800 dark:bg-slate-950">
        <div className="flex items-center gap-4">
          <button
            onClick={onBack}
            className="flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Library
          </button>
          <span className="h-4 w-px bg-slate-300 dark:bg-slate-700" />
          <h2 className="text-sm font-bold">Reading Habit Analytics & Insights</h2>
        </div>
      </div>

      <div className="flex-1 space-y-8 overflow-y-auto p-8">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-6 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="text-xs font-medium text-slate-400">Read Completion Rate</div>
            <div className="mt-3 font-mono text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {analytics.readPercent}%
            </div>
            <div className="mt-1.5 text-[11px] text-slate-500">
              {analytics.readArticles} of {analytics.totalArticles} articles read
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-6 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="text-xs font-medium text-slate-400">Current Reading Streak</div>
            <div className="mt-3 flex items-baseline gap-2 font-mono text-3xl font-extrabold text-amber-500 dark:text-amber-400">
              {analytics.streakDays} {analytics.streakDays === 1 ? 'Day' : 'Days'}
              <Flame className="h-5 w-5" />
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-6 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="text-xs font-medium text-slate-400">Estimated Reading Time</div>
            <div className="mt-3 font-mono text-3xl font-extrabold text-indigo-600 dark:text-indigo-400">
              {readingHours}h
            </div>
            <div className="mt-1.5 text-[11px] text-slate-500">
              ~{avgMinutesPerDay} mins / day average
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-6 dark:border-slate-800 dark:bg-slate-800/40">
            <div className="text-xs font-medium text-slate-400">Highlights & Notes Logged</div>
            <div className="mt-3 font-mono text-3xl font-extrabold text-rose-500 dark:text-rose-400">
              {analytics.totalHighlights}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-6 dark:border-slate-800 dark:bg-slate-800/40 md:col-span-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                Weekly Reading Activity (Articles Marked Read)
              </h4>
              <span className="font-mono text-xs text-slate-400">Past 7 Days</span>
            </div>
            <div className="flex h-44 items-end justify-between gap-3 border-b border-slate-200 pb-2 pt-4 dark:border-slate-700">
              {weeklyDays.map((day) => (
                <div key={day.date} className="flex h-full flex-1 flex-col items-center gap-1.5">
                  <span className="font-mono text-[10px] text-slate-400">{day.count}</span>
                  <div className="flex w-full flex-1 items-end">
                    <div
                      className="w-full rounded-t bg-indigo-500 transition-all"
                      style={{ height: `${Math.max(4, (day.count / maxWeeklyCount) * 100)}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-slate-500">{weekdayLabel(day.date)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50/70 p-6 dark:border-slate-800 dark:bg-slate-800/40">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
              Category Breakdown
            </h4>
            <div className="space-y-3 pt-2 text-xs">
              {analytics.perCategory.map((category) => {
                const percent =
                  analytics.totalArticles > 0
                    ? Math.round((category.total / analytics.totalArticles) * 100)
                    : 0
                return (
                  <div key={category.categoryId}>
                    <div className="mb-1 flex justify-between text-slate-600 dark:text-slate-300">
                      <span>{category.categoryName}</span>
                      <span className="font-mono text-indigo-500 dark:text-indigo-400">
                        {percent}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-900">
                      <div className="h-full bg-indigo-500" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                )
              })}
              {analytics.perCategory.length === 0 && (
                <p className="text-slate-400">No categories yet.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
