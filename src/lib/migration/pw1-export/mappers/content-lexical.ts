import { contentStyle } from './content-style'
import { isSafeContentLink } from './content-link'
import { createHash } from 'node:crypto'
import { load } from 'cheerio'
import type { AnyNode } from 'domhandler'
import {
  ref,
  type Doc,
  type Json,
  type MappingContext,
  type Row,
} from '../contracts'
import { safeUrl } from '../primitives'

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
export function blogLexical(ctx: MappingContext, row: Row): Doc {
  const $ = load(row.content || '', undefined, false)
  let ordinal = 0
  let imageIndex = 0
  const id = () =>
    createHash('sha256')
      .update(`blog:${row.id}:${ordinal++}`)
      .digest('hex')
      .slice(0, 24)
  const container = (type: string, children: Json[], extra: Doc = {}): Doc => ({
    type,
    children,
    direction: 'ltr',
    format: '',
    indent: 0,
    version: 1,
    ...extra,
  })
  function convert(
    nodes: AnyNode[],
    inheritedFormat = 0,
    inheritedStyle = '',
  ): Json[] {
    return nodes.flatMap((node): Json[] => {
      if (node.type === 'text')
        return [
          {
            type: 'text',
            text: node.data,
            detail: 0,
            format: inheritedFormat,
            mode: 'normal',
            style: inheritedStyle,
            version: 1,
          },
        ]
      if (node.type !== 'tag') {
        if (node.type === 'script' || node.type === 'style')
          ctx.issue('BLOG_UNSAFE_HTML_REMOVED', 'blog_posts', row.id, 'content')
        return []
      }
      const tag = node.name.toLowerCase()
      if (Object.keys(node.attribs).some((key) => /^on/i.test(key)))
        ctx.issue('BLOG_UNSAFE_HTML_REMOVED', 'blog_posts', row.id, 'content')
      let format = inheritedFormat
      const formats: Record<string, number> = {
        b: 1,
        strong: 1,
        i: 2,
        em: 2,
        s: 4,
        del: 4,
        u: 8,
        code: 16,
        sub: 32,
        sup: 64,
      }
      format |= formats[tag] ?? 0
      const style = node.attribs.style ?? inheritedStyle
      const { style: safeStyle, lostDeclarations } = contentStyle(style)
      if (lostDeclarations)
        ctx.issue('BLOG_STYLE_FIDELITY', 'blog_posts', row.id, 'content')
      if (tag === 'br') return [{ type: 'linebreak', version: 1 }]
      if (tag === 'img') {
        const media = contentMedia(
          ctx,
          row,
          node.attribs.src ?? '',
          String(imageIndex++),
          node.attribs.alt ?? '',
        )
        return media
          ? [
              {
                type: 'upload',
                version: 3,
                relationTo: 'media',
                value: media,
                fields: {},
                id: id(),
                format: '',
              },
            ]
          : []
      }
      const children = convert(node.children, format, safeStyle)
      if (tag === 'a') {
        const href = node.attribs.href ?? ''
        const safe = isSafeContentLink(href)
        if (!safe) {
          ctx.issue('BLOG_LINK_UNSAFE', 'blog_posts', row.id, 'content')
          return children
        }
        return [
          container('link', children, {
            version: 3,
            id: id(),
            fields: {
              linkType: 'custom',
              newTab: node.attribs.target === '_blank',
              url: href,
            },
          }),
        ]
      }
      if (/^h[1-6]$/.test(tag)) return [container('heading', children, { tag })]
      if (tag === 'p' || tag === 'div')
        return [
          container('paragraph', children, { textFormat: 0, textStyle: '' }),
        ]
      if (tag === 'ul' || tag === 'ol') {
        const items = children
          .filter(
            (child) =>
              child &&
              typeof child === 'object' &&
              !Array.isArray(child) &&
              child.type === 'listitem',
          )
          .map((child, index) => ({ ...(child as Doc), value: index + 1 }))
        return [
          container('list', items, {
            tag,
            listType: tag === 'ol' ? 'number' : 'bullet',
            start: 1,
          }),
        ]
      }
      if (tag === 'li') return [container('listitem', children, { value: 1 })]
      if (
        ![
          'span',
          'b',
          'strong',
          'i',
          'em',
          's',
          'del',
          'u',
          'code',
          'sub',
          'sup',
        ].includes(tag)
      )
        ctx.issue('BLOG_CONTENT_FIDELITY', 'blog_posts', row.id, 'content')
      return children
    })
  }
  const children = convert($.root().contents().toArray())
  if (!row.content)
    ctx.issue('BLOG_CONTENT_MISSING', 'blog_posts', row.id, 'content')
  const blocks: Json[] = []
  let inline: Json[] = []
  const flush = () => {
    if (inline.length) {
      blocks.push(
        container('paragraph', inline, { textFormat: 0, textStyle: '' }),
      )
      inline = []
    }
  }
  for (const node of children) {
    if (
      node &&
      typeof node === 'object' &&
      !Array.isArray(node) &&
      ['paragraph', 'heading', 'list', 'upload'].includes(String(node.type))
    ) {
      flush()
      blocks.push(node)
    } else inline.push(node)
  }
  flush()
  return { root: container('root', blocks) }
}
