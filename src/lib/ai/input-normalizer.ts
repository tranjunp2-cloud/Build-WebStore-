/**
 * Normalize user business input before sending to AI.
 * Trims whitespace, removes excessive special chars while preserving
 * Vietnamese diacritics and Unicode letters, and truncates overly long input.
 */
export function normalizeBusinessInput(text: string): string {
    let normalized = text.trim().replace(/\s+/g, ' ')
    // Remove non-text chars but keep Unicode letters, digits, common punctuation
    normalized = normalized.replace(/[^\p{L}\p{N}\s.,!?@#$%&*()\-/:'"]/gu, '')
    // Truncate to prevent token abuse
    if (normalized.length > 2000) normalized = normalized.slice(0, 2000)
    return normalized
}
