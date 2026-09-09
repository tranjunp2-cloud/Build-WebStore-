import { z } from 'zod'

const templateSearchQuerySchema = z
    .string()
    .trim()
    .min(1, 'Search query is required')
    .max(200, 'Search query is too long')

export const templateSearchFormSchema = z.object({
    query: templateSearchQuerySchema,
})

export const templateSearchRequestSchema = templateSearchFormSchema.extend({
    locale: z.enum(['en', 'vi', 'ms']),
})

export const templateCardResponseSchema = z.object({
    id: z.union([z.string(), z.number()]),
    name: z.string().min(1),
    description: z.string().nullish(),
    category: z.union([z.array(z.string()), z.string()]),
    thumbnail: z.object({ url: z.string().min(1) }).passthrough().nullish(),
    isPremium: z.boolean().nullish(),
    isFeatured: z.boolean().nullish(),
    defaultTheme: z.object({
        primaryColor: z.string().nullish(),
        secondaryColor: z.string().nullish(),
        colorMode: z.string().nullish(),
    }).passthrough().nullish(),
}).passthrough().transform((template) => ({
    id: String(template.id),
    name: template.name,
    description: template.description ?? '',
    category: Array.isArray(template.category) ? template.category : [template.category],
    ...(template.thumbnail?.url ? { thumbnail: { url: template.thumbnail.url } } : {}),
    isPremium: Boolean(template.isPremium),
    isFeatured: Boolean(template.isFeatured),
    defaultTheme: {
        primaryColor: template.defaultTheme?.primaryColor ?? '#3B82F6',
        ...(template.defaultTheme?.secondaryColor
            ? { secondaryColor: template.defaultTheme.secondaryColor }
            : {}),
        colorMode: template.defaultTheme?.colorMode ?? 'light',
    },
}))

export const templateCardArrayResponseSchema = z.array(templateCardResponseSchema)

export type TemplateSearchFormValues = z.infer<typeof templateSearchFormSchema>
export type TemplateSearchRequest = z.infer<typeof templateSearchRequestSchema>
