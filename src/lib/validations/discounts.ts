import { z } from 'zod'
import { MAX_FIXED_DISCOUNT_SEN } from '@/lib/discounts/format'

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
        // Fixed value is stored in sen; cap it so the formatted preview never overflows to 1e+ notation.
        if (data.type === 'fixed' && data.value != null && data.value > MAX_FIXED_DISCOUNT_SEN) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: 'Fixed amount is too large',
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
    // min 1 — null/blank = unlimited (PRD §9). 0 is invalid: it would make a discount born "at-limit"
    // (usageCount 0 >= limit 0 → silent reject), so we reject it here instead of persisting a dead code.
    usageLimit: z.number().int().min(1).optional().nullable(),
    startsAt: z.string().optional().nullable(),
    expiresAt: z.string().optional().nullable(),
    status: z.enum(['active', 'inactive']).optional(),
    site: z.union([z.string(), z.number()]).optional().nullable(),
})

export const createDiscountSchema = withDiscountRefinements(discountBaseObject)

// For updates: all fields optional, protected fields excluded
const updateBaseObject = discountBaseObject.partial()
export const updateDiscountSchema = withDiscountRefinements(updateBaseObject)
