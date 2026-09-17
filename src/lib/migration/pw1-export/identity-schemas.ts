import { z } from 'zod'
export const reference = z
  .string()
  .regex(/^@[a-z][a-z_-]*:[a-z_][a-z0-9_]*:[^\s:]+(?::[^\s:]+)*$/)
export const date = z.string().datetime()
const history = { createdAt: date, updatedAt: date }
const tenantSchema = z
  .object({
    _ref: reference,
    name: z.string().min(1),
    slug: z.string().min(3),
    status: z.enum([
      'active',
      'suspended',
      'trialing',
      'past_due',
      'cancelled',
    ]),
    plan: z.enum(['free', 'starter', 'pro', 'business']),
    metaData: z.object({ pw1StoreId: z.string().min(1) }).strict(),
    migrationStatus: z.literal('pending'),
    onboardingCompleted: z.literal(false),
    settings: z
      .object({
        allowedWebsites: z.literal(1),
        storageUsed: z.literal(0),
        storageLimitBytes: z.literal(0),
        dashboardPreferences: z.object({}).strict(),
      })
      .strict(),
    previousSlugs: z.array(z.never()),
    customDomains: z.array(
      z
        .object({
          domain: z.string(),
          status: z.literal('pending'),
          isPrimary: z.literal(false),
        })
        .strict(),
    ),
    whatsappNumber: z.string().optional(),
    businessAddress: z.string().optional(),
    payments: z
      .object({
        payment_cod: z.boolean(),
        payment_card: z.literal(false),
        payment_fpx: z.literal(false),
        payment_qr: z.literal(false),
      })
      .strict(),
    ...history,
  })
  .strict()
const userSchema = z
  .object({
    _ref: reference,
    email: z.string().email(),
    firstName: z.string().min(1),
    lastName: z.string(),
    phone: z.string().nullable(),
    roles: z.array(z.enum(['tenant-owner', 'editor', 'viewer'])).length(1),
    tenants: z
      .array(
        z
          .object({
            tenant: reference,
            role: z.enum(['owner', 'editor', 'viewer']),
            status: z.enum(['active', 'suspended']),
            permissions: z.array(z.never()),
          })
          .strict(),
      )
      .min(1),
    prefer_lang: z.string(),
    has_seen_ai_wizard: z.literal(false),
    migrationStatus: z.literal('pending'),
    otpAttempts: z.literal(0),
    createdBy: reference.optional(),
    lastLoginAt: date.optional(),
    ...history,
  })
  .strict()
const subscriptionSchema = z
  .object({
    _ref: reference,
    tenant: reference,
    name: z.literal('main'),
    plan: z.enum([
      'FREEMIUM',
      'STARTER_TM_USER',
      'STARTER_NON_TM_USER',
      'STANDARD_TM_USER',
      'STANDARD_NON_TM_USER',
      'PROFESSIONAL_TM_USER',
      'PROFESSIONAL_NON_TM_USER',
    ]),
    status: z.enum(['active', 'canceled', 'ended']),
    startsAt: date,
    endsAt: date,
    canceledAt: date.nullable(),
    canceledImmediately: z.boolean().optional(),
    ...history,
  })
  .strict()
const usageSchema = z
  .object({
    _ref: reference,
    subscription: reference,
    featureCode: z.string().min(1),
    used: z.number().int().min(0).max(32767),
    validUntil: date.nullable(),
    ...history,
  })
  .strict()
export const identitySchemas = {
  tenants: tenantSchema,
  users: userSchema,
  'plan-subscriptions': subscriptionSchema,
  'plan-subscription-usages': usageSchema,
}
