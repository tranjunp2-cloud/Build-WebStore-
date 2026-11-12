/**
 * Client side of POST /api/ai/translate, shared by every editor call site.
 *
 * A translation is stored in a locale slot only when the route really made one. Anything else
 * (non-2xx, `ok: false`, the legacy `status: 'fallback'` answer, no `translated` object) is a
 * failure: the caller keeps the slot empty so a later translate fills it, and tells the merchant.
 * `aborted` is a superseded language switch, not a failure.
 */

export type TranslationRequest = {
    blockType: string
    targetLocale: string
    content: Record<string, unknown>
    siteId?: string | number
    signal?: AbortSignal
}

export type TranslationResult =
    | { ok: true; translated: Record<string, unknown> }
    | { ok: false; reason: 'aborted' | 'unavailable' | 'rate_limited' }

export async function requestTranslation(request: TranslationRequest): Promise<TranslationResult> {
    const { signal, ...body } = request
    try {
        const res = await fetch('/api/ai/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            signal,
            body: JSON.stringify(body),
        })
        if (signal?.aborted) return { ok: false, reason: 'aborted' }
        if (res.status === 429) return { ok: false, reason: 'rate_limited' }
        if (!res.ok) return { ok: false, reason: 'unavailable' }
        const json = await res.json() as { ok?: boolean; status?: string; translated?: unknown }
        if (signal?.aborted) return { ok: false, reason: 'aborted' }
        if (json.ok === false || json.status === 'fallback') return { ok: false, reason: 'unavailable' }
        const translated = json.translated
        if (!translated || typeof translated !== 'object' || Array.isArray(translated) || Object.keys(translated).length === 0) {
            return { ok: false, reason: 'unavailable' }
        }
        return { ok: true, translated: translated as Record<string, unknown> }
    } catch (error) {
        if (signal?.aborted || (error instanceof DOMException && error.name === 'AbortError')) return { ok: false, reason: 'aborted' }
        return { ok: false, reason: 'unavailable' }
    }
}
