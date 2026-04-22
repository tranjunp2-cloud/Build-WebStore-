import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type NewsletterVariant = 'inline' | 'popup' | 'banner' | 'stacked-card' | 'minimal' | 'incentive-grid'

export const NEWSLETTER_VARIANTS: NewsletterVariant[] = [
    'inline',
    'popup',
    'banner',
    'stacked-card',
    'minimal',
    'incentive-grid',
]

export type NewsletterConfig = {
    blockType: 'newsletter'
    variant?: NewsletterVariant
    headline?: string
    subheadline?: string
    buttonLabel?: string
    placeholder?: string
}

export const NewsletterConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('newsletter'),
    variant: z.enum(['inline', 'popup', 'banner', 'stacked-card', 'minimal', 'incentive-grid']).default('inline'),
    headline: z.string().optional(),
    subheadline: z.string().optional(),
    buttonLabel: z.string().default('Subscribe'),
    placeholder: z.string().default('your@email.com'),
})

export const newsletterMeta = {
    type: 'newsletter' as const,
    name: 'Newsletter',
    description: 'Email subscription form',
    icon: '✉️',
    variants: NEWSLETTER_VARIANTS,
    defaultVariant: 'inline' as const,
    editableFields: ['headline', 'subheadline', 'buttonLabel'],
    quickActions: ['Change copy'],
}

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = NewsletterConfigSchema
