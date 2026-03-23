const BLOCKED_TERMS = [
    'porn',
    'pornography',
    'sex video',
    'escort',
    'prostitution',
    'brothel',
    'cocaine',
    'meth',
    'heroin',
    'marijuana for sale',
    'buy weed',
    'weapon trafficking',
    'gun for sale',
    'explosive',
    'bomb making',
    'hitman',
    'human trafficking',
]

export type BusinessInfoSafetyInput = {
    businessName: string
    industry: string
    shortDescription: string
    products: string
}

function normalizeForSafety(value: string) {
    return value
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
}

export function checkBusinessInfoSafety(input: BusinessInfoSafetyInput) {
    const combined = normalizeForSafety(
        [
            input.businessName,
            input.industry,
            input.shortDescription,
            input.products,
        ].join(' '),
    )

    const matchedTerm = BLOCKED_TERMS.find((term) => combined.includes(normalizeForSafety(term)))
    if (!matchedTerm) {
        return { safe: true as const, matchedTerm: null }
    }

    return {
        safe: false as const,
        matchedTerm,
        message: 'This request contains restricted business content and cannot be generated automatically.',
    }
}
