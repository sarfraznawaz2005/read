import { defaultSchema } from 'hast-util-sanitize'
import type { Schema } from 'hast-util-sanitize'
import { defaultUrlTransform } from 'react-markdown'

// rehype-sanitize's default schema only allows http/https for <img src> — a
// data: URI (a model inlining a base64 image) gets its src stripped entirely
// rather than just hidden. Ported from AgentDesk's markdown-sanitize-schema.ts.
export const markdownSanitizeSchema: Schema = {
  ...defaultSchema,
  protocols: {
    ...defaultSchema.protocols,
    src: [...(defaultSchema.protocols?.src ?? []), 'data']
  }
}

const DATA_IMAGE_URI = /^data:image\/[a-z0-9.+-]+;base64,/i

// react-markdown runs a second, independent sanitizer on every src/href on top
// of rehype-sanitize — its own protocol allowlist has no `data` entry, so it
// silently empties out `<img src="data:...">` even after markdownSanitizeSchema
// lets it through. Only `src` gets the data:image carve-out; `href` still goes
// through the untouched default so a data:text/html link can't slip through.
export function markdownUrlTransform(url: string, key: string): string {
  if (key === 'src' && DATA_IMAGE_URI.test(url)) return url
  return defaultUrlTransform(url)
}
