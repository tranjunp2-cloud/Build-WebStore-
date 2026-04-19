/**
 * User-input sanitizer for OpenAI prompt safety.
 *
 * Fixes intermittent staging bug:
 *   `[AI] OpenAI generation failed: 400 We could not parse JSON body`
 *
 * Root cause: when user-pasted content contains lone UTF-16 surrogates (half
 * of an emoji pair, common from mobile copy-paste or Windows clipboard), the
 * OpenAI SDK serializes the request body but the resulting string contains
 * ill-formed UTF-16. OpenAI's server rejects it with "could not parse JSON
 * body". Node.js's JSON.stringify escapes surrogates as \uXXXX since ES2019
 * but the pair still reads as invalid on the wire in some edge cases.
 *
 * Additional guards:
 *  - Strip NUL byte (0x00) — JSON spec allows as \u0000 but many servers
 *    reject it.
 *  - Normalize CRLF/CR → LF — prevents multi-line prompts from smuggling
 *    bare CR which some HTTP intermediaries mishandle.
 *
 * KISS: single pure function, applied at the boundary (before prompt build).
 */

/**
 * Return a JSON-safe copy of `str`:
 *  - drop lone UTF-16 surrogates
 *  - drop NUL bytes
 *  - normalize line endings to \n
 *
 * Safe for undefined/null (returns original). Does not mutate.
 */
export function sanitizeForPrompt(str: string | undefined | null): string | undefined {
    if (str == null) return undefined
    let out = ''
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i)
        // Skip NUL bytes entirely.
        if (code === 0x00) continue
        // High surrogate: expect a paired low surrogate next.
        if (code >= 0xd800 && code <= 0xdbff) {
            const next = str.charCodeAt(i + 1)
            if (next >= 0xdc00 && next <= 0xdfff) {
                // Valid surrogate pair — keep both.
                out += str[i] + str[i + 1]
                i++
                continue
            }
            // Lone high surrogate → drop.
            continue
        }
        // Lone low surrogate (no preceding high) → drop.
        if (code >= 0xdc00 && code <= 0xdfff) {
            continue
        }
        out += str[i]
    }
    // Normalize line endings last to avoid intermixing with surrogate logic.
    return out.replace(/\r\n?/g, '\n')
}

/**
 * Sanitize every string field on a business-info-like object.
 * Returns a new object — does not mutate input.
 */
export function sanitizeBusinessInfo<T extends Record<string, unknown>>(info: T): T {
    const cleaned: Record<string, unknown> = { ...info }
    for (const key of Object.keys(cleaned)) {
        const v = cleaned[key]
        if (typeof v === 'string') {
            cleaned[key] = sanitizeForPrompt(v)
        }
    }
    return cleaned as T
}
