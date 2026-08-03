import { createHash } from 'node:crypto'
import { normalizeImageTerm } from './relevance'

export interface PixabaySearchParameters {
    query: string
    imageType?: string
    orientation: 'horizontal' | 'all'
    category?: string
    language?: string
    safeSearch?: boolean
    perPage: number
    page?: number
}

export function createPixabayCacheKey(parameters: PixabaySearchParameters): string {
    const canonical: Record<string, string | number | boolean> = {
        category: normalizeImageTerm(parameters.category ?? ''),
        image_type: parameters.imageType ?? 'photo',
        language: parameters.language ?? '',
        orientation: parameters.orientation,
        page: parameters.page ?? 1,
        per_page: parameters.perPage,
        query: normalizeImageTerm(parameters.query),
        safesearch: parameters.safeSearch ?? true,
    }
    const serialized = Object.keys(canonical)
        .sort()
        .map((key) => `${key}=${String(canonical[key])}`)
        .join('&')
    return createHash('sha256').update(serialized).digest('hex')
}

export class SingleFlight<T> {
    private readonly inFlight = new Map<string, Promise<T>>()

    run(key: string, operation: () => Promise<T>): Promise<T> {
        const existing = this.inFlight.get(key)
        if (existing) return existing
        const pending = operation().finally(() => {
            if (this.inFlight.get(key) === pending) this.inFlight.delete(key)
        })
        this.inFlight.set(key, pending)
        return pending
    }
}
