/**
 * Normalize a phone number to the canonical form used as identity key in the DB.
 *
 * Strips: spaces, dashes, dots, parentheses, '+' prefix. Lowercases the result.
 * Returns null for empty / whitespace-only input.
 *
 * This function is the single source of truth for phone normalization.
 * It must stay in sync with:
 *   - scripts/db-setup.js — customers.normalize_existing_phones migration
 *   - The unique index expression in customers_tenant_phone_uniq (uses LOWER(TRIM(phone))
 *     which is equivalent because the DB stores pre-normalized values after migration)
 */
export function normalizePhone(raw: string | undefined | null): string | null {
    const stripped = String(raw ?? '').trim().replace(/[-\s()+.]/g, '').toLowerCase()
    if (!stripped) return null
    // Defence-in-depth: valid E.164 phones normalize to ≤ 15 chars.
    // >20 chars means garbage/attack input that bypassed frontend validation.
    if (stripped.length > 20) return null
    return stripped
}
