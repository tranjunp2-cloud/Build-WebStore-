import { z } from 'zod'
import { BaseBlockSchema } from '../types'

// ── CTA Block ──
export type CTAConfig = { blockType: 'cta'; variant?: 'banner' | 'inline' | 'floating'; headline: string; subheadline?: string; ctaLabel: string; ctaUrl: string; ctaStyle?: 'primary' | 'outline' }
export const CTAConfigSchema = BaseBlockSchema.extend({ blockType: z.literal('cta'), variant: z.enum(['banner', 'inline', 'floating']).default('banner'), headline: z.string(), subheadline: z.string().optional(), ctaLabel: z.string(), ctaUrl: z.string(), ctaStyle: z.enum(['primary', 'outline']).default('primary') })
export const ctaMeta = { type: 'cta' as const, name: 'CTA', description: 'Call to action banner', icon: '📣', variants: ['banner', 'inline', 'floating'], defaultVariant: 'banner', editableFields: ['headline', 'subheadline', 'ctaLabel', 'ctaUrl'], quickActions: ['Rewrite CTA', 'Make urgent'] }
