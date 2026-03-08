import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type NewsletterConfig = { blockType: 'newsletter'; variant?: 'inline' | 'popup' | 'banner'; headline?: string; subheadline?: string; buttonLabel?: string; placeholder?: string }
export const NewsletterConfigSchema = BaseBlockSchema.extend({ blockType: z.literal('newsletter'), variant: z.enum(['inline', 'popup', 'banner']).default('inline'), headline: z.string().optional(), subheadline: z.string().optional(), buttonLabel: z.string().default('Subscribe'), placeholder: z.string().default('your@email.com') })
export const newsletterMeta = { type: 'newsletter' as const, name: 'Newsletter', description: 'Email subscription form', icon: '✉️', variants: ['inline', 'popup', 'banner'], defaultVariant: 'inline', editableFields: ['headline', 'subheadline', 'buttonLabel'], quickActions: ['Change copy'] }
