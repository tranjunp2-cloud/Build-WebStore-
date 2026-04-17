import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type PropertyItem = {
    title: string
    price: number
    location: string
    bedrooms: number
    bathrooms: number
    area: number
    imageUrls: string[]
    type: 'sale' | 'rent'
    status?: string
    mapUrl?: string
    description?: string
}

export type PropertyCardConfig = {
    blockType: 'property-card'
    variant?: 'grid' | 'list' | 'featured'
    headline: string
    subheadline?: string
    properties: PropertyItem[]
    showMap: boolean
    currency: string
}

export const PropertyCardConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('property-card'),
    variant: z.enum(['grid', 'list', 'featured']).default('grid'),
    headline: z.string(),
    subheadline: z.string().optional(),
    properties: z.array(z.object({
        title: z.string(),
        price: z.number(),
        location: z.string(),
        bedrooms: z.number(),
        bathrooms: z.number(),
        area: z.number(),
        imageUrls: z.array(z.string()).default([]),
        type: z.enum(['sale', 'rent']),
        status: z.string().optional(),
        mapUrl: z.string().optional(),
        description: z.string().optional(),
    })).default([]),
    showMap: z.boolean().default(false),
    currency: z.string().default('RM'),
})

export const propertyCardMeta = {
    type: 'property-card' as const,
    name: 'Property Card',
    description: 'Real estate listings with specs, images and pricing',
    icon: '\uD83C\uDFE0',
    variants: ['grid', 'list', 'featured'],
    defaultVariant: 'grid',
    editableFields: ['headline', 'subheadline', 'properties', 'showMap', 'currency'],
    quickActions: ['Add property', 'Filter by type', 'Update prices'],
    aiVisible: false,
}
