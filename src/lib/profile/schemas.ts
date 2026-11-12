import { z } from 'zod'
import { PASSWORD_MIN_LENGTH } from '@/lib/auth/password-rules'

export const profilePatchSchema = z.object({
    // Messages are i18n keys under profile.errors (never raw zod text).
    firstName: z.string().min(2, 'nameLength').max(50, 'nameLength').optional(),
    // Last name is optional: '' (new staff are invited without a name) is valid.
    lastName: z.string()
        .refine(v => v === '' || (v.length >= 2 && v.length <= 50), 'nameLength')
        .optional(),
    phone: z.string()
        .refine(
            val => !val || /^\+\d{1,3}$/.test(val) || /^\+\d{8,15}$/.test(val),
            'invalidPhone',
        )
        .optional(),
}).refine(d => Object.keys(d).length > 0, { message: 'atLeastOneFieldRequired' })

export const passwordBaseSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string()
        .min(PASSWORD_MIN_LENGTH, 'passwordMinLength')
        .regex(/[A-Z]/, 'passwordUpper')
        .regex(/[0-9]/, 'passwordNumber'),
})

export const passwordChangeSchema = passwordBaseSchema.refine(
    d => d.currentPassword !== d.newPassword,
    { message: 'newPasswordSameAsCurrent', path: ['newPassword'] },
)

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024
export const AVATAR_ALLOWED_MIME = ['image/jpeg', 'image/png'] as const
