import { z } from 'zod'

/** The same categories supported by the PW2 composer. */
export const Pw1IndustrySchema = z.object({
    category: z.enum(['restaurant', 'ecommerce', 'beauty', 'tech', 'health', 'education', 'realestate', 'fitness', 'creative', 'business', 'fnb', 'events', 'travel', 'blog']),
    confidence: z.enum(['high', 'medium', 'low']),
    reason: z.string(),
}).strict()

export function resolvePw1Industry(value: unknown) {
    const parsed = Pw1IndustrySchema.safeParse(value)
    if (!parsed.success) return { category: 'business' as const, confidence: 'low' as const, reason: 'Industry evidence unavailable.' }
    return { ...parsed.data, category: parsed.data.confidence === 'low' ? 'business' as const : parsed.data.category }
}

/** Read only the migration result; ordinary generation has no such metadata. */
export function getPw1Industry(result: unknown) {
    const parsed = z.object({ sourceMigration: z.object({ industry: Pw1IndustrySchema }) }).safeParse(result)
    return resolvePw1Industry(parsed.success ? parsed.data.sourceMigration.industry : undefined)
}
