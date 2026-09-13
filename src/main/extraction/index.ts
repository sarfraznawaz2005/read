import { JSDOM } from 'jsdom'
import { Readability } from '@mozilla/readability'
import createDOMPurify from 'dompurify'
import hljs from 'highlight.js'
import { DESKTOP_USER_AGENT } from '../userAgent'

const purifyWindow = new JSDOM('').window
const DOMPurify = createDOMPurify(purifyWindow as unknown as Window & typeof globalThis)

// Common short "language badge" words some sites (e.g. MDN) place as a standalone
// element right before a code block instead of a real class hint. Kept tight and
// exact-match-only so ordinary prose (e.g. a paragraph that just says "SQL") is
// never mistaken for a label - see below, we also require it to be the ENTIRE
// content of a childless element directly touching the <pre>.
const LANGUAGE_LABELS = new Set([
  'js',
  'javascript',
  'jsx',
  'ts',
  'typescript',
  'tsx',
  'css',
  'scss',
  'less',
  'html',
  'htm',
  'json',
  'bash',
  'shell',
  'sh',
  'zsh',
  'python',
  'py',
  'sql',
  'java',
  'kotlin',
  'swift',
  'c',
  'cpp',
  'c++',
  'csharp',
  'c#',
  'go',
  'golang',
  'rust',
  'php',
  'ruby',
  'rb',
  'yaml',
  'yml',
  'xml',
  'plaintext',
  'text',
  'txt',
  'markdown',
  'md'
])

/**
 * Colors code blocks at save time (baked in as static <span class="hljs-...">
 * markup) and consumes stray language-badge labels (e.g. a floating "js" line
 * right before a <pre>) into the block's language class instead of leaving
 * them as visible clutter.
 */
function highlightCodeBlocks(html: string): string {
  const dom = new JSDOM(`<body>${html}</body>`)
  const document = dom.window.document

  for (const pre of Array.from(document.querySelectorAll('pre'))) {
    let languageHint: string | null = null

    const prev = pre.previousElementSibling
    if (prev) {
      const text = (prev.textContent ?? '').trim().toLowerCase()
      if (text && LANGUAGE_LABELS.has(text)) {
        languageHint = text
        prev.remove()
      }
    }

    const codeEl = pre.querySelector('code') ?? pre
    if (!languageHint) {
      const classHint = Array.from(codeEl.classList).find((c) => /^(language|lang)-/.test(c))
      if (classHint) languageHint = classHint.replace(/^(language|lang)-/, '')
    }

    const code = codeEl.textContent ?? ''
    if (!code.trim()) continue

    let highlighted: { value: string; language?: string }
    try {
      highlighted =
        languageHint && hljs.getLanguage(languageHint)
          ? hljs.highlight(code, { language: languageHint })
          : hljs.highlightAuto(code)
    } catch {
      continue
    }

    const newCode = document.createElement('code')
    newCode.className = `hljs${highlighted.language ? ` language-${highlighted.language}` : ''}`
    newCode.innerHTML = highlighted.value

    pre.innerHTML = ''
    pre.appendChild(newCode)
  }

  return document.body.innerHTML
}

export interface ExtractedArticle {
  title: string | null
  author: string | null
  contentHtml: string | null
  contentText: string | null
  images: string[]
}

export async function extractArticle(url: string): Promise<ExtractedArticle> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': DESKTOP_USER_AGENT
    },
    signal: AbortSignal.timeout(20000)
  })

  if (!response.ok) {
    throw new Error(`Fetch failed with status ${response.status} ${response.statusText}`)
  }

  const html = await response.text()
  const dom = new JSDOM(html, { url })
  const reader = new Readability(dom.window.document)
  const result = reader.parse()

  if (!result || !result.content) {
    throw new Error('Could not extract readable content from this page')
  }

  let contentWithHighlightedCode = result.content
  try {
    contentWithHighlightedCode = highlightCodeBlocks(result.content)
  } catch {
    // Fall back to unhighlighted content rather than failing the whole save.
  }

  const sanitizedHtml = DOMPurify.sanitize(contentWithHighlightedCode, {
    FORBID_TAGS: ['script', 'style', 'iframe', 'object', 'embed', 'form'],
    FORBID_ATTR: ['style']
  })

  return {
    title: result.title || null,
    author: result.byline || null,
    contentHtml: sanitizedHtml,
    contentText: result.textContent || null,
    images: extractImageUrls(sanitizedHtml)
  }
}

function extractImageUrls(html: string): string[] {
  return Array.from(html.matchAll(/<img[^>]+src="([^"]+)"/g), (match) => match[1])
}
