import { ref, type Doc, type MappingContext, type Row } from '../contracts'
import { timestamp } from '../primitives'
import { mapRawContent } from './content-raw'
import { blogLexical, contentMedia } from './content-lexical'

function dates(ctx: MappingContext, table: string, row: Row): Doc | undefined {
  try {
    return {
      createdAt: timestamp(row.created_at, ctx.config),
      updatedAt: timestamp(row.updated_at, ctx.config),
    }
  } catch {
    ctx.issue('CONTENT_TIMESTAMP_INVALID', table, row.id)
    return undefined
  }
}
function validSlug(ctx: MappingContext, table: string, row: Row): boolean {
  if (
    !row.slug?.trim() ||
    row.slug === '.' ||
    row.slug === '..' ||
    row.slug.includes('/')
  ) {
    ctx.issue('BLOG_SLUG_INVALID', table, row.id, 'slug')
    return false
  }
  if (
    (ctx.tables[table] ?? []).filter(
      (candidate) => !candidate.deleted_at && candidate.store_id === row.store_id && candidate.slug?.trim().toLowerCase() === row.slug?.trim().toLowerCase(),
    ).length !== 1
  ) {
    ctx.issue('BLOG_SLUG_COLLISION', table, row.id, 'slug')
    return false
  }
  return true
}
function mapBlogs(ctx: MappingContext): void {
  const tenant = ref('tenants', 'stores', ctx.storeId)
  const site = ref('sites', 'stores', ctx.storeId)
  for (const row of ctx.rows('blog_categories')) {
    if (row.deleted_at) continue
    if (row.status !== '1') {
      ctx.issue('BLOG_CATEGORY_INACTIVE', 'blog_categories', row.id, 'status')
      continue
    }
    const time = dates(ctx, 'blog_categories', row)
    if (!time || !validSlug(ctx, 'blog_categories', row) || !row.name) {
      if (!row.name)
        ctx.issue(
          'BLOG_CATEGORY_NAME_MISSING',
          'blog_categories',
          row.id,
          'name',
        )
      continue
    }
    ctx.output.blog_categories.push({
      _ref: ref('blog_categories', 'blog_categories', row.id!),
      tenant,
      name: row.name,
      slug: row.slug!,
      status: 'active',
      ...time,
    })
    ctx.contribute(
      'blog_categories',
      row,
      ['id', 'store_id', 'name', 'slug', 'status', 'created_at', 'updated_at'],
      ref('blog_categories', 'blog_categories', row.id!),
      'MASTER_8_1',
    )
  }
  for (const row of ctx.rows('blog_posts')) {
    if (row.deleted_at) continue
    const time = dates(ctx, 'blog_posts', row)
    if (!time || !validSlug(ctx, 'blog_posts', row) || !row.name) {
      if (!row.name)
        ctx.issue('BLOG_TITLE_MISSING', 'blog_posts', row.id, 'name')
      continue
    }
    const author = ref('users', 'users', row.created_by ?? '')
    if (!ctx.output.users.some((user) => user._ref === author)) {
      ctx.issue('BLOG_AUTHOR_UNRESOLVED', 'blog_posts', row.id, 'created_by')
      continue
    }
    const blog: Doc = {
      _ref: ref('blogs', 'blog_posts', row.id!),
      tenant,
      site,
      title: row.name,
      slug: row.slug!,
      status: 'draft',
      author,
      ...time,
      seo: {
        metaTitle: row.title ?? '',
        metaDescription: row.meta_description ?? '',
      },
    }
    if (row.blog_category_id) {
      const category = ref(
        'blog_categories',
        'blog_categories',
        row.blog_category_id,
      )
      if (ctx.output.blog_categories.some((item) => item._ref === category))
        blog.category = category
      else
        ctx.issue(
          'BLOG_CATEGORY_UNRESOLVED',
          'blog_posts',
          row.id,
          'blog_category_id',
        )
    }
    if (row.image) {
      const thumbnail = contentMedia(ctx, row, row.image, 'thumbnail', row.name)
      if (thumbnail) blog.thumbnail = thumbnail
    }
    blog.content = blogLexical(ctx, row)
    ctx.output.blogs.push(blog)
    ctx.contribute(
      'blog_posts',
      row,
      [
        'id',
        'store_id',
        'name',
        'slug',
        'status',
        'created_by',
        'created_at',
        'updated_at',
        'title',
        'meta_description',
        'blog_category_id',
        'image',
        'content',
      ],
      String(blog._ref),
      'MASTER_8_2',
    )
  }
}
function mapEmail(ctx: MappingContext): void {
  if (ctx.config.migrationPolicy?.deferEmailTemplates) return
  const types: Record<string, string> = {
    '1': 'order-confirmation',
    '2': 'order-cancelled',
    '3': 'order-completed',
  }
  for (const row of ctx.rows('store_email_templates')) {
    if (row.deleted_at) continue
    const templateType = types[row.type_id ?? '']
    const time = dates(ctx, 'store_email_templates', row)
    if (!templateType || !['0', '1'].includes(row.status ?? '') || !time) {
      ctx.issue('EMAIL_TEMPLATE_UNSUPPORTED', 'store_email_templates', row.id)
      continue
    }
    if (
      ctx
        .rows('store_email_templates')
        .filter((other) => !other.deleted_at && other.type_id === row.type_id)
        .length !== 1
    ) {
      ctx.issue(
        'EMAIL_TEMPLATE_DUPLICATE',
        'store_email_templates',
        row.id,
        'type_id',
      )
      continue
    }
    const email: Doc = {
      _ref: ref('email-template-settings', 'store_email_templates', row.id!),
      tenant: ref('tenants', 'stores', ctx.storeId),
      templateType,
      recipient: 'buyer',
      enabled: row.status === '1',
      ...time,
    }
    let invalid = false
    for (const [locale, suffix] of [
      ['contentEn', ''],
      ['contentMs', '_ms'],
    ]) {
      const content: Doc = {}
      for (const [source, target, limit] of [
        ['subject', 'subject', 200],
        ['greeting_message', 'greeting', 500],
        ['button_label', 'ctaLabel', 100],
        ['closing_message', 'closing', 2000],
      ] as const) {
        const value = row[source + suffix]
        if (value != null) content[target] = value
        if (value && value.length > limit) {
          ctx.issue(
            'EMAIL_FIELD_TOO_LONG',
            'store_email_templates',
            row.id,
            source + suffix,
          )
          invalid = true
        }
        if (!value)
          ctx.issue(
            'EMAIL_EMPTY_LOCALE_FALLBACK',
            'store_email_templates',
            row.id,
            source + suffix,
          )
      }
      email[locale] = content
    }
    if (invalid) continue
    ctx.issue(
      'EMAIL_GREETING_SEMANTICS',
      'store_email_templates',
      row.id,
      'greeting_message',
    )
    ctx.output['email-template-settings'].push(email)
    ctx.contribute(
      'store_email_templates',
      row,
      [
        'id',
        'store_id',
        'type_id',
        'status',
        'subject',
        'subject_ms',
        'greeting_message',
        'greeting_message_ms',
        'button_label',
        'button_label_ms',
        'closing_message',
        'closing_message_ms',
        'created_at',
        'updated_at',
      ],
      String(email._ref),
      'MASTER_8_3',
    )
  }
}
export function mapContent(ctx: MappingContext): void {
  mapRawContent(ctx)
  mapBlogs(ctx)
  mapEmail(ctx)
}
