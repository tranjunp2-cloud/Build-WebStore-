import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type BookingService = {
    name: string
    duration: number
    price: number
    description?: string
}

export type BookingWidgetConfig = {
    blockType: 'booking-widget'
    variant?: 'inline' | 'sidebar' | 'modal-trigger'
    headline: string
    subheadline?: string
    services: BookingService[]
    availableDays: number[]
    timeSlotInterval: number
    startTime: string
    endTime: string
    bookingUrl?: string
    showPrice: boolean
}

export const BookingWidgetConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('booking-widget'),
    variant: z.enum(['inline', 'sidebar', 'modal-trigger']).default('inline'),
    headline: z.string(),
    subheadline: z.string().optional(),
    services: z.array(z.object({
        name: z.string(),
        duration: z.number(),
        price: z.number(),
        description: z.string().optional(),
    })).default([]),
    availableDays: z.array(z.number().min(0).max(6)).default([1, 2, 3, 4, 5]),
    timeSlotInterval: z.number().default(30),
    startTime: z.string().default('09:00'),
    endTime: z.string().default('18:00'),
    bookingUrl: z.string().optional(),
    showPrice: z.boolean().default(true),
})

export const bookingWidgetMeta = {
    type: 'booking-widget' as const,
    name: 'Booking Widget',
    description: 'Service booking form with date/time selection',
    icon: '\uD83D\uDCC5',
    variants: ['inline', 'sidebar', 'modal-trigger'],
    defaultVariant: 'inline',
    editableFields: ['headline', 'subheadline', 'services', 'availableDays', 'timeSlotInterval', 'startTime', 'endTime', 'bookingUrl', 'showPrice'],
    quickActions: ['Add service', 'Change time slots', 'Update availability'],
    aiVisible: false,
}

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = BookingWidgetConfigSchema
