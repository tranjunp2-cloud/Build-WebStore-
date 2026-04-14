import { z } from 'zod'

export const generateSiteSchema = z.object({
    businessInfo: z.object({
        businessName: z.string().min(1),
        industry: z.string().min(1),
        products: z.string().min(1),
        shortDescription: z.string().min(1),
        businessUrl: z.string().url().optional(),
        source: z.enum(['form', 'url', 'image']).optional(),
        slug: z.string().regex(/^[a-z0-9-]+$/).min(3).max(63).optional(),
        // Plan 260414-2249 phase-01: user-supplied optional fields. Wire-level
        // ephemeral — not persisted to Payload, used only for this generation.
        tagline: z.string().max(200).optional(),
        phone: z.string().max(40).optional(),
        email: z.string().email().max(100).optional().or(z.literal('')),
        address: z.string().max(300).optional(),
    }),
    extraInstructions: z.string().optional(),
    language: z.enum(['en', 'ms', 'vi', 'auto']).optional(),
    contentBrief: z.record(z.unknown()).optional(),
})

export const extractFromUrlSchema = z.object({
    url: z.string().url().max(2048),
})

export const extractionResultSchema = z.object({
    businessName: z.string().default(''),
    industry: z.string().default(''),
    shortDescription: z.string().default(''),
    products: z.string().default(''),
    referenceContent: z.object({
        heroHeadline: z.string().nullish(),
        heroSubheadline: z.string().nullish(),
        heroCtaText: z.string().nullish(),
        aboutText: z.string().nullish(),
        featuresList: z.array(z.object({
            title: z.string(),
            description: z.string(),
        })).nullish(),
        testimonials: z.array(z.object({
            quote: z.string(),
            name: z.string(),
            role: z.string().nullish(),
        })).nullish(),
        pricingPlans: z.array(z.object({
            name: z.string(),
            price: z.string(),
            features: z.array(z.string()),
        })).nullish(),
        faqItems: z.array(z.object({
            question: z.string(),
            answer: z.string(),
        })).nullish(),
        contactInfo: z.object({
            phone: z.string().nullish(),
            email: z.string().nullish(),
            address: z.string().nullish(),
        }).nullish(),
        footerText: z.string().nullish(),
        // v2 fields
        collectionsList: z.array(z.string()).nullish(),
        brandTagline: z.string().nullish(),
        socialProofStats: z.array(z.object({
            number: z.string(),
            label: z.string(),
        })).nullish(),
        blogPostTitles: z.array(z.string()).nullish(),
        ctaTexts: z.array(z.string()).nullish(),
        navigationItems: z.array(z.string()).nullish(),
        sectionOrder: z.array(z.string()).nullish(),
    }).default({}),
    suggestedTheme: z.object({
        primaryColor: z.string().nullish(),
        secondaryColor: z.string().nullish(),
        backgroundColor: z.string().nullish(),
        siteType: z.string().nullish(),
        mood: z.string().nullish(),
    }).nullish(),
    suggestedBlocks: z.array(z.string()).optional(),
    detectedLanguage: z.enum(['en', 'ms', 'vi']).default('en'),
    confidence: z.enum(['high', 'medium', 'low']).default('medium'),
})

export const editBlockSchema = z.object({
    instruction: z.string().min(1),
    block: z.record(z.unknown()).nullable().optional(),
    blockIndex: z.number().nullable().optional(),
    allBlocks: z.array(z.record(z.unknown())).optional(),
    theme: z.record(z.unknown()).optional(),
    siteName: z.string().optional(),
})

export const rewriteTextSchema = z.object({
    text: z.string().min(1),
    instruction: z.string().min(1),
    context: z.string().optional(),
    language: z.string().optional(),
})

export const applyTemplateSchema = z.object({
    templateId: z.union([z.string().min(1), z.number()]).transform(String),
    siteId: z.union([z.string(), z.number()]).optional().transform((v) => v != null ? String(v) : undefined),
})
