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

/**
 * Check if text contains a blocked term as a whole word (not as a substring).
 * E.g. "meth" should match "buy meth online" but NOT "payment methods".
 */
function findBlockedTerm(normalized: string): string | undefined {
    return BLOCKED_TERMS.find((term) => {
        const pattern = new RegExp(`\\b${normalizeForSafety(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`)
        return pattern.test(normalized)
    })
}

const BLOCKED_DOMAINS = ['localhost', '127.0.0.1', '0.0.0.0']

export function checkUrlSafety(url: string): { safe: boolean; message: string } {
    try {
        const parsed = new URL(url)
        const hostname = parsed.hostname.toLowerCase()
        if (BLOCKED_DOMAINS.some((d) => hostname === d || hostname.endsWith(`.${d}`))) {
            return { safe: false, message: 'This URL is not allowed.' }
        }
        return { safe: true, message: '' }
    } catch {
        return { safe: false, message: 'Invalid URL format.' }
    }
}

export function checkScrapedContentSafety(text: string): { safe: boolean; message: string } {
    const normalized = normalizeForSafety(text)
    const matchedTerm = findBlockedTerm(normalized)
    if (!matchedTerm) {
        return { safe: true, message: '' }
    }
    return {
        safe: false,
        message: 'The website content contains restricted material and cannot be processed.',
    }
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

    const matchedTerm = findBlockedTerm(combined)
    if (!matchedTerm) {
        return { safe: true as const, matchedTerm: null }
    }

    return {
        safe: false as const,
        matchedTerm,
        message: 'This request contains restricted business content and cannot be generated automatically.',
    }
}
