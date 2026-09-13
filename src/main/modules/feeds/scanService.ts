import type { FeedScanResult } from '@shared/types'
import { showDesktopNotification } from '../../notifications'
import { refreshTrayUnreadState } from '../../tray'
import { getMainWindow } from '../../windowRegistry'
import { getSettings } from '../settings/repository'
import { fetchFeed } from './fetch'
import {
  getFeedById,
  listFeeds,
  markFeedFailed,
  markFeedOk,
  pruneExpiredFeedItems,
  pruneOldFeedItems,
  upsertFeedItems,
  type IncomingFeedItem
} from './repository'

export function applyFeedLimits(items: IncomingFeedItem[]): IncomingFeedItem[] {
  const settings = getSettings()
  let result = items

  if (settings.feedMaxAgeDays > 0) {
    const cutoff = Date.now() - settings.feedMaxAgeDays * 24 * 60 * 60 * 1000
    result = result.filter(
      (item) => !item.publishedAt || new Date(item.publishedAt).getTime() >= cutoff
    )
  }

  if (settings.feedMaxEntriesPerFeed > 0) {
    result = result
      .slice()
      .sort(
        (a, b) => new Date(b.publishedAt ?? 0).getTime() - new Date(a.publishedAt ?? 0).getTime()
      )
      .slice(0, settings.feedMaxEntriesPerFeed)
  }

  return result
}

export async function refreshFeedById(feedId: string): Promise<number> {
  const feed = getFeedById(feedId)
  if (!feed) throw new Error(`Feed ${feedId} not found`)
  try {
    const fetched = await fetchFeed(feed.feedUrl)
    const inserted = upsertFeedItems(feedId, applyFeedLimits(fetched.items))
    markFeedOk(feedId)
    return inserted
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch feed'
    markFeedFailed(feedId, message)
    throw error
  }
}

function notifyScanResult(result: FeedScanResult, trigger: 'manual' | 'auto'): void {
  if (result.feedsScanned === 0) return
  if (result.newItems === 0 && result.feedsFailed === 0 && trigger === 'auto') return

  const parts: string[] = []
  parts.push(
    result.newItems > 0
      ? `${result.newItems} new article${result.newItems === 1 ? '' : 's'}`
      : 'No new articles'
  )
  if (result.feedsFailed > 0) {
    parts.push(`${result.feedsFailed} feed${result.feedsFailed === 1 ? '' : 's'} failed`)
  }

  showDesktopNotification('Feed scan complete', parts.join(' • '), () => {
    getMainWindow()?.webContents.send('app:openFeeds')
  })
}

async function runScan(trigger: 'manual' | 'auto'): Promise<FeedScanResult> {
  const feeds = listFeeds()
  let newItems = 0
  let feedsFailed = 0

  for (const feed of feeds) {
    try {
      newItems += await refreshFeedById(feed.id)
    } catch {
      feedsFailed += 1
    }
  }

  const maxTotalEntries = getSettings().feedMaxTotalEntries
  if (maxTotalEntries > 0) pruneOldFeedItems(maxTotalEntries)

  const maxAgeDays = getSettings().feedMaxAgeDays
  if (maxAgeDays > 0) pruneExpiredFeedItems(maxAgeDays)

  const result: FeedScanResult = { newItems, feedsScanned: feeds.length, feedsFailed }
  notifyScanResult(result, trigger)
  refreshTrayUnreadState()
  getMainWindow()?.webContents.send('feeds:scanFinished', result)
  return result
}

// A manual scan and the automatic timer scan can overlap; sharing one in-flight
// promise guarantees exactly one notification per scan instead of two.
let inFlightScan: Promise<FeedScanResult> | null = null

export async function scanAllFeeds(trigger: 'manual' | 'auto' = 'manual'): Promise<FeedScanResult> {
  if (inFlightScan) return inFlightScan
  inFlightScan = runScan(trigger).finally(() => {
    inFlightScan = null
  })
  return inFlightScan
}
