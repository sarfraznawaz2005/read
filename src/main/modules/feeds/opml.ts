import { dialog } from 'electron'
import { readFile, writeFile } from 'fs/promises'
import { XMLBuilder, XMLParser } from 'fast-xml-parser'
import { showDesktopNotification } from '../../notifications'
import { getFeedByUrl, insertFeed, listFeeds } from './repository'

interface OpmlOutline {
  '@_text'?: string
  '@_title'?: string
  '@_xmlUrl'?: string
  '@_htmlUrl'?: string
  outline?: OpmlOutline | OpmlOutline[]
}

function collectOutlines(node: OpmlOutline | OpmlOutline[] | undefined): OpmlOutline[] {
  if (!node) return []
  const nodes = Array.isArray(node) ? node : [node]
  const result: OpmlOutline[] = []
  for (const entry of nodes) {
    if (entry['@_xmlUrl']) result.push(entry)
    if (entry.outline) result.push(...collectOutlines(entry.outline))
  }
  return result
}

export async function importOpml(): Promise<{ added: number; skipped: number } | null> {
  const result = await dialog.showOpenDialog({
    title: 'Import OPML',
    filters: [{ name: 'OPML', extensions: ['opml', 'xml'] }],
    properties: ['openFile']
  })
  if (result.canceled || result.filePaths.length === 0) return null

  const xml = await readFile(result.filePaths[0], 'utf-8')
  const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' })
  const parsed = parser.parse(xml) as {
    opml?: { body?: { outline?: OpmlOutline | OpmlOutline[] } }
  }
  const outlines = collectOutlines(parsed.opml?.body?.outline)

  let added = 0
  let skipped = 0
  for (const outline of outlines) {
    const feedUrl = outline['@_xmlUrl']
    if (!feedUrl || getFeedByUrl(feedUrl)) {
      skipped += 1
      continue
    }
    const title = outline['@_title'] || outline['@_text'] || feedUrl
    insertFeed(title, feedUrl, outline['@_htmlUrl'] || null)
    added += 1
  }

  showDesktopNotification(
    'OPML import complete',
    `Imported ${added} feed${added === 1 ? '' : 's'}, skipped ${skipped}`
  )

  return { added, skipped }
}

export async function exportOpml(): Promise<string | null> {
  const result = await dialog.showSaveDialog({
    title: 'Export OPML',
    defaultPath: 'read-feeds.opml',
    filters: [{ name: 'OPML', extensions: ['opml'] }]
  })
  if (result.canceled || !result.filePath) return null

  const feeds = listFeeds()
  const builder = new XMLBuilder({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    format: true
  })
  const body = builder.build({
    opml: {
      '@_version': '2.0',
      head: { title: 'Read! Subscriptions' },
      body: {
        outline: feeds.map((feed) => ({
          '@_text': feed.title,
          '@_title': feed.title,
          '@_type': 'rss',
          '@_xmlUrl': feed.feedUrl,
          '@_htmlUrl': feed.siteUrl ?? ''
        }))
      }
    }
  }) as string

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n${body}`
  await writeFile(result.filePath, xml, 'utf-8')
  return result.filePath
}
