import { z } from 'zod'
import { SITES_VALID_SITE_TYPES } from '../../../ai/site-type'
import type { Json } from '../contracts'
const reference = z.string().regex(/^@[a-z_-]+:[a-z_]+:[^\s]+$/)
const date = z.string().datetime()
export const lexical: z.ZodType<Json> = z.lazy(() =>
  z
    .object({
      type: z.enum([
        'root',
        'paragraph',
        'heading',
        'list',
        'listitem',
        'text',
        'linebreak',
        'quote',
        'link',
        'upload',
      ]),
      version: z.number().int(),
      children: z.array(lexical).optional(),
      direction: z.enum(['ltr', 'rtl']).nullable().optional(),
      format: z.union([z.string(), z.number()]).optional(),
      indent: z.number().optional(),
      text: z.string().optional(),
      detail: z.number().optional(),
      checked: z.boolean().optional(),
      mode: z.literal('normal').optional(),
      style: z.string().optional(),
      textFormat: z.number().optional(),
      textStyle: z.string().optional(),
      tag: z.string().optional(),
      listType: z.enum(['bullet', 'number']).optional(),
      start: z.number().optional(),
      value: z.union([reference, z.number()]).optional(),
      relationTo: z.literal('media').optional(),
      id: z.string().optional(),
      fields: z
        .object({
          doc: z.null().optional(),
          linkType: z.literal('custom').optional(),
          newTab: z.boolean().optional(),
          url: z.string().optional(),
        })
        .strict()
        .optional(),
    })
    .strict(),
)
export const blogCategorySchema = z
  .object({
    _ref: reference,
    tenant: reference,
    name: z.string().min(1),
    slug: z.string().min(1),
    status: z.literal('active'),
    createdAt: date,
    updatedAt: date,
  })
  .strict()
export const blogSchema = z
  .object({
    _ref: reference,
    tenant: reference,
    site: reference,
    title: z.string().min(1),
    slug: z.string().min(1),
    status: z.literal('draft'),
    author: reference,
    category: reference.optional(),
    thumbnail: reference.optional(),
    createdAt: date,
    updatedAt: date,
    seo: z
      .object({ metaTitle: z.string(), metaDescription: z.string() })
      .strict(),
    content: z.object({ root: lexical }).strict(),
  })
  .strict()
const emailLocale = z
  .object({
    subject: z.string().max(200).optional(),
    greeting: z.string().max(500).optional(),
    ctaLabel: z.string().max(100).optional(),
    closing: z.string().max(2000).optional(),
  })
  .strict()
export const emailTemplateSchema = z
  .object({
    _ref: reference,
    tenant: reference,
    templateType: z.enum([
      'order-confirmation',
      'order-cancelled',
      'order-completed',
    ]),
    recipient: z.literal('buyer'),
    enabled: z.boolean(),
    contentEn: emailLocale,
    contentMs: emailLocale,
    createdAt: date,
    updatedAt: date,
  })
  .strict()

import { RAW_FIELDS } from './raw-fields'
import { safeUrl } from '../primitives'
const raw = (table: string) =>
  z
    .object(
      Object.fromEntries(
        (RAW_FIELDS[table] ?? []).map((field) => [
          field,
          z.string().nullable().optional(),
        ]),
      ),
    )
    .strict()
const setting = raw('model_settings')
const component = raw('page_components')
  .extend({
    frontend_component: raw('frontend_components').nullable(),
    model_settings: z.array(setting),
    banners: z.array(raw('banners')),
    shortlist_items: z.array(raw('shortlist_items')),
  })
  .strict()
export const pageDocumentSchema = raw('pages')
  .extend({
    _ref: reference,
    id: z.string().min(1),
    store_id: z.string().min(1),
    components: z.array(component),
    model_settings: z.array(setting),
  })
  .strict()
const menuLine = raw('menu_lines')
  .extend({
    menu_line_type: raw('menu_line_types').nullable(),
    model_settings: z.array(setting),
  })
  .strict()
const menuItem = raw('menu_items')
  .extend({
    menu_line_type: raw('menu_line_types').nullable(),
    model_settings: z.array(setting),
    menu_lines: z.array(menuLine),
  })
  .strict()
const menu = raw('menus')
  .extend({ model_settings: z.array(setting), menu_items: z.array(menuItem) })
  .strict()
const rawSource = z
  .object({
    store: raw('stores'),
    frontend_template: raw('frontend_templates').nullable(),
    model_settings: z.array(setting),
    brands: z.array(raw('brands')),
    categories: z.array(raw('categories')),
    products: z.array(raw('products')),
    blog_categories: z.array(raw('blog_categories')),
    blog_posts: z.array(raw('blog_posts')),
    store_domains: z.array(raw('store_domains')),
    attributes: z.array(raw('attributes')),
    attribute_values: z.array(raw('attribute_values')),
    category_attributes: z.array(raw('category_attributes')),
  })
  .strict()
const externalUrl = z.string().superRefine((value, ctx) => {
  try {
    safeUrl(value)
  } catch {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'Unsafe external URL',
    })
  }
})
export const mediaDocumentSchema = z
  .object({
    _ref: reference,
    url: externalUrl,
    sourceUrl: externalUrl,
    alt: z.string().optional(),
    createdAt: date.optional(),
    updatedAt: date.optional(),
  })
  .strict()
  .refine((doc) => doc.url === doc.sourceUrl, {
    message: 'External Media URL mismatch',
  })
export const siteDocumentSchema = z
  .object({
    _ref: reference,
    tenant: reference,
    name: z.string().min(1),
    status: z.literal('draft'),
    generationStatus: z.literal('none'),
    siteType: z.enum(SITES_VALID_SITE_TYPES),
    shippingConfig: z.object({
      enabled: z.literal(true),
      westRate: z.number().int().min(0).max(100000),
      eastRate: z.number().int().min(0).max(100000),
      freeAbove: z.null(),
      shippingSetupConfirmed: z.literal(false),
    }).strict().optional(),
    locale: z.literal('ms'),
    generationLocale: z.literal('ms'),
    domain: z.string().min(1),
    seo: z
      .object({ metaTitle: z.string(), metaDescription: z.string() })
      .strict(),
    branding: z
      .object({ logo: externalUrl.optional(), favicon: externalUrl.optional() })
      .strict(),
    contactInfo: z
      .object({
        phone: z.string().optional(),
        email: z.string(),
        address: z.string().optional(),
      })
      .strict(),
    socialLinks: z.object({}).strict(),
    paymentConfig: z
      .object({
        enableCod: z.boolean(),
        enableQrBanking: z.literal(false),
        cardEnabled: z.literal(false),
        fpxEnabled: z.literal(false),
      })
      .strict(),
    pw1_source: rawSource,
    menus: z.array(menu),
  })
  .strict()
export const blogCategoryDocumentSchema = blogCategorySchema
export const blogDocumentSchema = blogSchema
export const emailDocumentSchema = emailTemplateSchema
