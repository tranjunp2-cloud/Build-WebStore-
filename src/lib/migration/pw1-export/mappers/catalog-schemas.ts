import { z } from 'zod'
import { lexical } from './content-schemas'
const reference = z.string().regex(/^@[a-z_-]+:[a-z_]+:[^:]+$/)
const dates = {
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
}
export const categoryDocumentSchema = z
  .object({
    _ref: reference,
    tenant: reference,
    site: reference,
    name: z.string().min(1),
    slug: z.string().min(1),
    breadcrumbs: z.string(),
    parent: reference.optional(),
    description: z.string().optional(),
    ...dates,
  })
  .strict()
const lexicalDocument = z.object({ root: lexical }).strict()
export const productDocumentSchema = z
  .object({
    _ref: reference,
    tenant: reference,
    site: reference,
    name: z.string().min(3).max(120),
    slug: z.string().min(1),
    currency: z.enum(['MYR', 'USD', 'SGD']),
    status: z.enum(['draft', 'active']),
    halalCertified: z.literal(false),
    aiReviewPending: z.literal(false),
    category: z.array(reference).max(1),
    images: z
      .array(
        z.object({ image: reference, alt: z.string().optional() }).strict(),
      ),
    tags: z.array(z.object({ tag: z.string() }).strict()),
    attributes: z.array(
      z.object({ key: z.string(), value: z.string() }).strict(),
    ),
    hasVariants: z.boolean(),
    sku: z.string().max(50).optional(),
    price: z.number().finite().nonnegative().max(100000000),
    inventory: z.number().int().nonnegative().max(1000000),
    variantConfigs: z
      .array(
        z
          .object({
            name: z.string().min(1),
            options: z
              .array(z.object({ value: z.string().min(1) }).strict())
              .max(30),
          })
          .strict(),
      )
      .max(2),
    variants: z
      .array(
        z
          .object({
            id: z.string().uuid(),
            name: z.string().min(1),
            sku: z.string().max(100).optional(),
            price: z.number().finite().nonnegative().max(100000000),
            stock: z.number().int().nonnegative().max(1000000),
          })
          .strict(),
      )
      .max(900),
    shortDescription: z.string().optional(),
    description: lexicalDocument.optional(),
    descriptionBM: lexicalDocument.optional(),
    weight: z.number().finite().nonnegative().optional(),
    dimensions: z
      .object({
        length: z.number().finite().nonnegative().optional(),
        width: z.number().finite().nonnegative().optional(),
        height: z.number().finite().nonnegative().optional(),
      })
      .strict()
      .optional(),
    ...dates,
  })
  .strict()
