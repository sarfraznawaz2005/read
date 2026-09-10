import { JSDOM } from 'jsdom'
import Parser from 'rss-parser'
import type { IncomingFeedItem } from './repository'

const parser = new Parser()

// Some feeds put raw HTML (or HTML entities) in title/summary fields instead of
// plain text. Round-tripping through a real HTML parser strips tags and decodes
// entities (e.g. "Josh Comeau&#39;s blog" -> "Josh Comeau's blog") in one step.
const decoderDiv = new JSDOM('').window.document.createElement('div')

function stripHtml(input: string | null | undefined): string | null {
  if (!input) return null
  decoderDiv.innerHTML = input
  const text = (decoderDiv.textContent ?? '').replace(/\s+/g, ' ').trim()
  return text || null
}

export interface FetchedFeed {
  title: string
  siteUrl: string | null
  items: IncomingFeedItem[]
}

export async function fetchFeed(feedUrl: string): Promise<FetchedFeed> {
  const parsed = await parser.parseURL(feedUrl)
  const items: IncomingFeedItem[] = (parsed.items ?? [])
    .map((item) => ({
      title: stripHtml(item.title),
      link: item.link ?? item.guid ?? '',
      summary: stripHtml(item.contentSnippet ?? item.summary),
      publishedAt: item.isoDate ?? item.pubDate ?? null
    }))
    .filter((item) => item.link)

  return {
    title: stripHtml(parsed.title) ?? feedUrl,
    siteUrl: parsed.link ?? null,
    items
  }
}
