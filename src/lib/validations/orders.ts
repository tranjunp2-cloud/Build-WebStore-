import { z } from 'zod'

export const orderCreateSchema = z.object({
    siteId: z.string().min(1),
    items: z.array(z.object({
        productId: z.string().min(1),
        quantity: z.number().min(1),
    })).min(1),
    customer: z.object({
        name: z.string().min(1),
        email: z.string().email(),
        phone: z.string().optional(),
        address: z.object({
            line1: z.string().optional(),
            line2: z.string().optional(),
            city: z.string().optional(),
            state: z.string().optional(),
            postcode: z.string().optional(),
            country: z.string().optional(),
        }).optional(),
    }),
})
