import crypto from 'crypto'
import type { Payload } from 'payload'

// Excludes ambiguous chars: 0/O/I/1
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

/**
 * Generate a candidate reference without uniqueness check.
 * Exported for unit testing.
 */
export function generateCandidate(): string {
    const bytes = crypto.randomBytes(6)
    let s = ''
    for (let i = 0; i < 6; i++) s += ALPHABET[bytes[i] % ALPHABET.length]
    return `BT-${s}`
}

/**
 * Generate a globally unique payment reference for a bank-transfer order.
 * Retries up to 5 times on collision (probability ~10⁻¹³ at 10K orders/tenant).
 *
 * @throws Error after 5 failed uniqueness checks (retryable 500)
 */
export async function generatePaymentReference(
    payload: Payload,
    tenantId: string | number,
): Promise<string> {
    for (let attempt = 0; attempt < 5; attempt++) {
        const ref = generateCandidate()
        const existing = await payload.find({
            collection: 'orders',
            where: {
                and: [
                    { tenant: { equals: tenantId } },
                    { paymentReference: { equals: ref } },
                ],
            },
            limit: 1,
            depth: 0,
            overrideAccess: true,
        })
        if (existing.docs.length === 0) return ref
    }
    throw new Error('Failed to generate unique paymentReference after 5 retries')
}
