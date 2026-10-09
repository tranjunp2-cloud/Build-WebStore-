import { approvedSourceExclusionReason } from '../source-exclusions'
import { documentSchemas } from '../artifact-schemas'
import { ref, type Doc, type MappingContext, type Row } from '../contracts'
import { timestamp, compareIds } from '../primitives'
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
  const flattenBlogCategories =
    ctx.config.migrationPolicy?.flattenBlogCategoriesToRoot === true
  if (
    (ctx.tables[table] ?? []).filter(
      (candidate) =>
        !candidate.deleted_at &&
        !(
          table === 'blog_categories' &&
          (candidate.status === '0' ||
            (flattenBlogCategories &&
              candidate.parent_id &&
              candidate.parent_id !== '0'))
        ) &&
        candidate.store_id === row.store_id &&
        candidate.slug?.trim().toLowerCase() === row.slug?.trim().toLowerCase(),
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
  const flattenBlogCategories =
    ctx.config.migrationPolicy?.flattenBlogCategoriesToRoot === true
  const resolveDuplicateBlogCategorySlugs =
    ctx.config.migrationPolicy?.resolveDuplicateBlogCategorySlugs === true
  const resolveDuplicateBlogSlugs =
    ctx.config.migrationPolicy?.resolveDuplicateBlogSlugs === true
  const sourceBlogCategories = new Map(
    (ctx.tables.blog_categories ?? [])
      .filter((c) => c.store_id === ctx.storeId && !c.deleted_at)
      .map((c) => [c.id!, c]),
  )
  const blogCategories = ctx
    .rows('blog_categories')
    .sort((a, b) => compareIds(a.id ?? '', b.id ?? ''))
  const seenBlogCategorySlugs = new Map<string, string>()
  for (const row of blogCategories) {
    if (row.deleted_at || row.status === '0') continue
    if (flattenBlogCategories && row.parent_id && row.parent_id !== '0') {
      ctx.issue(
        'BLOG_CHILD_CATEGORY_EXCLUDED',
        'blog_categories',
        row.id,
        'parent_id',
        'warning',
        'CHILD_CATEGORY_OUTSIDE_FLAT_TAXONOMY',
      )
      // The category is not emitted; raw CSV retention accounts for its fields.
      continue
    }
    if (row.status !== '1') {
      ctx.issue('BLOG_CATEGORY_STATUS_UNVERIFIED', 'blog_categories', row.id, 'status')
      continue
    }
    const time = dates(ctx, 'blog_categories', row)
    if (!time || !row.name) {
      if (!row.name)
        ctx.issue(
          'BLOG_CATEGORY_NAME_MISSING',
          'blog_categories',
          row.id,
          'name',
        )
      continue
    }
    let resolvedSlug = row.slug?.trim()
    if (
      !resolvedSlug ||
      resolvedSlug === '.' ||
      resolvedSlug === '..' ||
      resolvedSlug.includes('/')
    ) {
      ctx.issue('BLOG_SLUG_INVALID', 'blog_categories', row.id, 'slug')
      continue
    }
    if (resolveDuplicateBlogCategorySlugs) {
      const normalized = resolvedSlug.toLowerCase()
      const existingOwner = seenBlogCategorySlugs.get(normalized)
      if (!existingOwner || existingOwner === row.id) {
        seenBlogCategorySlugs.set(normalized, row.id ?? '')
      } else {
        const suffix = `-BC${row.id}`
        let candidate = `${resolvedSlug}${suffix}`
        let collisionCounter = 1
        while (
          seenBlogCategorySlugs.has(candidate.toLowerCase()) &&
          seenBlogCategorySlugs.get(candidate.toLowerCase()) !== row.id
        ) {
          candidate = `${resolvedSlug}-BC${row.id}-${collisionCounter}`
          collisionCounter++
        }
        seenBlogCategorySlugs.set(candidate.toLowerCase(), row.id ?? '')
        ctx.issue(
          'BLOG_CATEGORY_SLUG_COLLISION_RESOLVED',
          'blog_categories',
          row.id,
          'slug',
          'warning',
          'BLOG_CATEGORY_SLUG_COLLISION_RESOLVED',
        )
        resolvedSlug = candidate
      }
    } else {
      if (!validSlug(ctx, 'blog_categories', row)) continue
    }
    ctx.output.blog_categories.push({
      _ref: ref('blog_categories', 'blog_categories', row.id!),
      tenant,
      name: row.name,
      slug: resolveDuplicateBlogCategorySlugs ? resolvedSlug : row.slug!,
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
  const blogPosts = ctx
    .rows('blog_posts')
    .sort((a, b) => compareIds(a.id ?? '', b.id ?? ''))
  const seenBlogSlugs = new Map<string, string>()
  for (const row of blogPosts) {
    if (row.deleted_at) continue
    if (!['0', '1'].includes(row.status ?? '')) {
      ctx.issue('BLOG_STATUS_UNVERIFIED', 'blog_posts', row.id, 'status')
      continue
    }
    const time = dates(ctx, 'blog_posts', row)
    if (!time || !row.name) {
      if (!row.name)
        ctx.issue('BLOG_TITLE_MISSING', 'blog_posts', row.id, 'name')
      continue
    }
    let resolvedSlug = row.slug?.trim()
    if (
      !resolvedSlug ||
      resolvedSlug === '.' ||
      resolvedSlug === '..' ||
      resolvedSlug.includes('/')
    ) {
      ctx.issue('BLOG_SLUG_INVALID', 'blog_posts', row.id, 'slug')
      continue
    }
    if (resolveDuplicateBlogSlugs) {
      const normalized = resolvedSlug.toLowerCase()
      const existingOwner = seenBlogSlugs.get(normalized)
      if (!existingOwner || existingOwner === row.id) {
        seenBlogSlugs.set(normalized, row.id ?? '')
      } else {
        const suffix = `-B${row.id}`
        let candidate = `${resolvedSlug}${suffix}`
        let collisionCounter = 1
        while (
          seenBlogSlugs.has(candidate.toLowerCase()) &&
          seenBlogSlugs.get(candidate.toLowerCase()) !== row.id
        ) {
          candidate = `${resolvedSlug}-B${row.id}-${collisionCounter}`
          collisionCounter++
        }
        seenBlogSlugs.set(candidate.toLowerCase(), row.id ?? '')
        ctx.issue(
          'BLOG_SLUG_COLLISION_RESOLVED',
          'blog_posts',
          row.id,
          'slug',
          'warning',
          'BLOG_SLUG_COLLISION_RESOLVED',
        )
        resolvedSlug = candidate
      }
    } else {
      if (!validSlug(ctx, 'blog_posts', row)) continue
    }
    const sourceAuthor = ref('users', 'users', row.created_by ?? '')
    const owners = ctx.output.users.filter(user => Array.isArray(user.tenants) &&
      user.tenants.some(membership => membership && typeof membership === 'object' &&
        !Array.isArray(membership) && membership.tenant === tenant && membership.role === 'owner'))
    const fallbackUser = owners.length === 1 ? owners[0]._ref : undefined
    const author = ctx.output.users.some(user => user._ref === sourceAuthor && Array.isArray(user.tenants) &&
      user.tenants.some(membership => membership && typeof membership === 'object' &&
        !Array.isArray(membership) && membership.tenant === tenant))
      ? sourceAuthor : fallbackUser
    if (typeof author !== 'string') {
      ctx.issue('BLOG_AUTHOR_UNRESOLVED', 'blog_posts', row.id, 'created_by')
      continue
    }
    if (author !== sourceAuthor && ctx.config.migrationPolicy?.fallbackBlogAuthorToOwner) {
      ctx.issue(
        'BLOG_AUTHOR_FALLBACK_OWNER',
        'blog_posts',
        row.id,
        'created_by',
        'warning',
        'AUTHOR_FALLBACK_APPLIED',
      )
    }
    const blog: Doc = {
      _ref: ref('blogs', 'blog_posts', row.id!),
      tenant,
      site,
      title: row.name,
      slug: resolveDuplicateBlogSlugs ? resolvedSlug : row.slug!,
      status: row.status === '1' ? 'published' : 'draft',
      author,
      ...time,
      seo: {
        metaTitle: row.title ?? '',
        metaDescription: row.meta_description ?? '',
      },
    }
    if (row.blog_category_id) {
      let targetCategoryId = row.blog_category_id
      if (flattenBlogCategories) {
        let currentId: string | undefined = row.blog_category_id
        const visited = new Set<string>()
        while (currentId) {
          if (visited.has(currentId)) {
            break
          }
          visited.add(currentId)
          const cat = sourceBlogCategories.get(currentId)
          if (!cat) break
          const parentId =
            cat.parent_id && cat.parent_id !== '0' ? cat.parent_id : ''
          if (!parentId) {
            targetCategoryId = cat.id!
            break
          }
          currentId = parentId
        }
        if (targetCategoryId !== row.blog_category_id) {
          ctx.issue(
            'BLOG_CATEGORY_REMAPPED_TO_ROOT',
            'blog_posts',
            row.id,
            'blog_category_id',
            'warning',
            'CHILD_CATEGORY_REMAPPED_TO_ROOT',
          )
        }
      }
      const category = ref(
        'blog_categories',
        'blog_categories',
        targetCategoryId,
      )
      if (ctx.output.blog_categories.some((item) => item._ref === category))
        blog.category = category
      else if (
        !ctx.tables.blog_categories?.some(
          (source) =>
            source.id === targetCategoryId &&
            source.store_id === ctx.storeId &&
            !source.deleted_at &&
            source.status === '0',
        )
      )
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
  excludeInvalidBlogs(ctx)
  mapEmail(ctx)
}

/** Omit only identified source-invalid Blog records; retain unexpected errors as blockers. */
function excludeInvalidBlogs(ctx: MappingContext): void {
  if (!ctx.config.migrationPolicy?.excludeInvalidBlogs) return
  for (const [table, collection] of [['blog_categories', 'blog_categories'], ['blog_posts', 'blogs']] as const) {
    for (const row of ctx.rows(table).filter(row => !row.deleted_at)) {
      const reference = ref(collection, table, row.id!)
      const doc = ctx.output[collection].find(doc => doc._ref === reference)
      if (doc && !documentSchemas[collection].safeParse(doc).success)
        ctx.issue('DOCUMENT_SCHEMA_INVALID', table, row.id)
      if (table === 'blog_posts' && doc?.category && !ctx.output.blog_categories.some(category => category._ref === doc.category))
        ctx.issue('BLOG_CATEGORY_UNRESOLVED', table, row.id, 'blog_category_id')
      const issues = ctx.diagnostics.filter(d => d.storeId === ctx.storeId && d.table === table && d.sourceId === row.id)
      const reasonOf = (d: typeof issues[number]) => d.code === 'RAW_VALUE_UNVERIFIED' ? d.reason ?? '' : d.code
      const sourceIssues = issues.filter(d => approvedSourceExclusionReason(table, reasonOf(d)))
      if (!sourceIssues.length || issues.some(d => d.severity === 'blocker' && !approvedSourceExclusionReason(table, reasonOf(d)))) continue
      ctx.output[collection] = ctx.output[collection].filter(doc => doc._ref !== reference)
      const mediaRef = ref('media', table, row.id!)
      ctx.output.media = ctx.output.media.filter(doc => doc._ref !== mediaRef && !String(doc._ref).startsWith(`@media:blog_posts_content:${row.id}:`))
      for (let i = ctx.contributions.length - 1; i >= 0; i--) {
        const c = ctx.contributions[i]
        if ((c.table === table && c.sourceId === row.id) || c.targetPath === reference) ctx.contributions.splice(i, 1)
      }
      for (let i = ctx.diagnostics.length - 1; i >= 0; i--) if (issues.includes(ctx.diagnostics[i])) ctx.diagnostics.splice(i, 1)
      ctx.issue('SOURCE_ENTITY_EXCLUDED', table, row.id, undefined, 'warning', reasonOf(sourceIssues[0]))
    }
  }
}
