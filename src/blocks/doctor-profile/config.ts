import { z } from 'zod'
import { BaseBlockSchema } from '../types'

export type DoctorItem = {
    name: string
    specialisation: string
    qualifications: string[]
    photoUrl?: string
    availableDays: number[]
    languages?: string
    consultationFee?: string
    bio?: string
}

export type DoctorProfileConfig = {
    blockType: 'doctor-profile'
    variant?: 'cards' | 'detailed' | 'list'
    headline: string
    subheadline?: string
    doctors: DoctorItem[]
}

export const DoctorProfileConfigSchema = BaseBlockSchema.extend({
    blockType: z.literal('doctor-profile'),
    variant: z.enum(['cards', 'detailed', 'list']).default('cards'),
    headline: z.string(),
    subheadline: z.string().optional(),
    doctors: z.array(z.object({
        name: z.string(),
        specialisation: z.string(),
        qualifications: z.array(z.string()).default([]),
        photoUrl: z.string().optional(),
        availableDays: z.array(z.number().min(0).max(6)).default([]),
        languages: z.string().optional(),
        consultationFee: z.string().optional(),
        bio: z.string().optional(),
    })).default([]),
})

export const doctorProfileMeta = {
    type: 'doctor-profile' as const,
    name: 'Doctor Profile',
    description: 'Medical professional cards with qualifications and availability',
    icon: '\uD83E\uDE7A',
    variants: ['cards', 'detailed', 'list'],
    defaultVariant: 'cards',
    editableFields: ['headline', 'subheadline', 'doctors'],
    quickActions: ['Add doctor', 'Update availability', 'Edit qualifications'],
    aiVisible: false,
}

/** Canonical configSchema export for block-schema-registry.ts introspection */
export const configSchema = DoctorProfileConfigSchema
