import { ref, type Doc, type MappingContext, type Row } from '../contracts'
import { safeUrl } from '../primitives'
import { sourceTextLexical } from './product-lexical'

export function contentMedia(
  ctx: MappingContext,
  row: Row,
  raw: string,
  suffix: string,
  alt = '',
): string | undefined {
  try {
    const url = safeUrl(raw)
    const identity =
      suffix === 'thumbnail'
        ? ref('media', 'blog_posts', row.id!)
        : ref('media', 'blog_posts_content', `${row.id}:${suffix}`)
    ctx.output.media.push({ _ref: identity, url, sourceUrl: url, alt })
    return identity
  } catch {
    ctx.issue('BLOG_MEDIA_UNRESOLVED', 'blog_posts', row.id, suffix)
    return undefined
  }
}
/** Preserve source HTML as opaque text for the separate rich-text workflow. */
export function blogLexical(_ctx: MappingContext, row: Row): Doc {
  return sourceTextLexical(row.content ?? '')
}
