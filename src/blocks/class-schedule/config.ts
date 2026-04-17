import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type ClassItem = {
    name: string
    instructor: string
    day: number
    startTime: string
    endTime: string
    capacity: number
    enrolled?: number
    category?: string
    level?: string
}

export type ClassScheduleConfig = {
    blockType: 'class-schedule'
    variant?: 'grid' | 'list' | 'cards'
    headline: string
    classes: ClassItem[]
    showCapacity: boolean
    highlightToday: boolean
}

export const ClassScheduleConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('class-schedule'),
    variant: z.enum(['grid', 'list', 'cards']).default('grid'),
    headline: z.string(),
    classes: z.array(z.object({
        name: z.string(),
        instructor: z.string(),
        day: z.number().min(0).max(6),
        startTime: z.string(),
        endTime: z.string(),
        capacity: z.number(),
        enrolled: z.number().optional(),
        category: z.string().optional(),
        level: z.string().optional(),
    })).default([]),
    showCapacity: z.boolean().default(true),
    highlightToday: z.boolean().default(true),
})

export const classScheduleMeta = {
    type: 'class-schedule' as const,
    name: 'Class Schedule',
    description: 'Weekly timetable for classes, sessions and workshops',
    icon: '\uD83D\uDDD3\uFE0F',
    variants: ['grid', 'list', 'cards'],
    defaultVariant: 'grid',
    editableFields: ['headline', 'classes', 'showCapacity', 'highlightToday'],
    quickActions: ['Add class', 'Update schedule', 'Change instructor'],
    aiVisible: false,
}
