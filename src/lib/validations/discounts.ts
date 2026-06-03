import { z } from 'zod'

const codeRegex = /^[A-Z0-9_-]+$/

function withDiscountRefinements<T extends z.ZodObject<any>>(schema: T) {
    return schema.superRefine((data, ctx) => {
        if (data.type === 'percentage' && data.value != null && data.value > 100) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Percentage value must be 100 or less',
                path: ['value'],
            })
        }
        if (data.startsAt && data.expiresAt) {
            const starts = new Date(data.startsAt)
            const expires = new Date(data.expiresAt)
            if (!isNaN(starts.getTime()) && !isNaN(expires.getTime()) && expires <= starts) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: 'expiresAt must be after startsAt',
                    path: ['expiresAt'],
                })
            }
        }
    })
}

const discountBaseObject = z.object({
    code: z
        .string()
        .min(1)
        .max(32)
        .transform((v) => v.trim().toUpperCase())
        .refine((v) => codeRegex.test(v), {
            message: 'Code must contain only letters, numbers, underscores, and hyphens',
        }),
    description: z.string().max(500).optional().nullable(),
    type: z.enum(['percentage', 'fixed']),
    value: z.number().min(0),
    usageLimit: z.number().int().min(0).optional().nullable(),
    startsAt: z.string().optional().nullable(),
    expiresAt: z.string().optional().nullable(),
    status: z.enum(['active', 'inactive']).optional(),
    site: z.union([z.string(), z.number()]).optional().nullable(),
})

export const createDiscountSchema = withDiscountRefinements(discountBaseObject)

// For updates: all fields optional, protected fields excluded
const updateBaseObject = discountBaseObject.partial()
export const updateDiscountSchema = withDiscountRefinements(updateBaseObject)
