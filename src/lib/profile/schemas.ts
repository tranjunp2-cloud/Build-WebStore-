import { z } from 'zod'

export const profilePatchSchema = z.object({
    firstName: z.string().min(2).max(50).optional(),
    lastName: z.string().min(2).max(50).optional(),
    phone: z.string().regex(/^\+?[0-9\s\-\(\)]{7,20}$/, 'invalidPhone').optional(),
}).refine(d => Object.keys(d).length > 0, { message: 'atLeastOneFieldRequired' })

export const passwordBaseSchema = z.object({
    currentPassword: z.string().min(1),
    newPassword: z.string()
        .min(8, 'passwordMinLength')
        .regex(/[A-Z]/, 'passwordUpper')
        .regex(/[a-z]/, 'passwordLower')
        .regex(/[0-9]/, 'passwordNumber')
        .regex(/[^A-Za-z0-9]/, 'passwordSpecial'),
})

export const passwordChangeSchema = passwordBaseSchema.refine(
    d => d.currentPassword !== d.newPassword,
    { message: 'newPasswordSameAsCurrent', path: ['newPassword'] },
)

export const AVATAR_MAX_BYTES = 2 * 1024 * 1024
export const AVATAR_ALLOWED_MIME = ['image/jpeg', 'image/png'] as const
