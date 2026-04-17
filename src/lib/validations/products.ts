import { z } from 'zod'

export const generateDescriptionSchema = z.object({
    name: z.string().min(1),
    category: z.string().optional(),
    features: z.string().optional(),
})
