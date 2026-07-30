import type { StockImageCandidate } from './contracts'

const PIXABAY_LICENSE_NAME = 'Pixabay Content License'
const PIXABAY_LICENSE_URL = 'https://pixabay.com/service/license-summary/'

function isCreativeCommonsReusableUrl(rawUrl: string): boolean {
    try {
        const url = new URL(rawUrl)
        if (
            url.protocol !== 'https:'
            || !['creativecommons.org', 'www.creativecommons.org'].includes(url.hostname)
        ) {
            return false
        }
        return (
            /^\/licenses\/by(?:-sa)?\//.test(url.pathname)
            || /^\/publicdomain\/(?:zero|mark)\//.test(url.pathname)
        )
    } catch {
        return false
    }
}

export function hasReusableStockLicense(
    candidate: Pick<StockImageCandidate, 'provider' | 'licenseName' | 'licenseUrl'>,
): boolean {
    const name = candidate.licenseName.trim()
    const url = candidate.licenseUrl.trim()
    if (!name || !url) return false
    if (candidate.provider === 'pixabay') {
        return name === PIXABAY_LICENSE_NAME && url === PIXABAY_LICENSE_URL
    }

    const normalized = name.toLowerCase()
    if (/\bnc\b|\bnd\b|noncommercial|no derivatives/.test(normalized)) return false
    return (
        isCreativeCommonsReusableUrl(url)
        && (
            /\bcc0\b/.test(normalized)
            || /public domain/.test(normalized)
            || /\bcc[\s_-]*by(?:[\s_-]*sa)?(?:\b|[-/])/.test(normalized)
        )
    )
}
