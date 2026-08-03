import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type ServiceItem = {
    title: string
    description: string
    icon: string
    price?: string
    priceUnit?: string
    cta?: {
        label: string
        url: string
    }
}

export type ServiceCardsConfig = {
    blockType: 'service-cards'
    variant?: 'grid' | 'list' | 'featured'
    headline: string
    subheadline?: string
    services: ServiceItem[]
}

export function serviceCardsGridClass(itemCount: number): string {
    if (itemCount <= 1) return 'grid-cols-1 max-w-xl mx-auto'
    if (itemCount === 2) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-2 max-w-5xl mx-auto'
    return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
}

export const ServiceCardsConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('service-cards'),
    variant: z.enum(['grid', 'list', 'featured']).default('grid'),
    headline: z.string(),
    subheadline: z.string().optional(),
    services: z.array(z.object({
        title: z.string(),
        description: z.string(),
        icon: z.string(),
        price: z.string().optional(),
        priceUnit: z.string().optional(),
        cta: z.object({
            label: z.string(),
            url: z.string(),
        }).optional(),
    })).default([]),
})

export const serviceCardsMeta = {
    type: 'service-cards' as const,
    name: 'Service Cards',
    description: 'Service cards with icons, pricing and CTA buttons',
    icon: '🛠️',
    variants: ['grid', 'list', 'featured'],
    defaultVariant: 'grid',
    editableFields: ['headline', 'subheadline', 'services'],
    quickActions: ['Add service', 'Rewrite descriptions', 'Change icons'],
    category: 'basics' as const,
}

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = ServiceCardsConfigSchema
