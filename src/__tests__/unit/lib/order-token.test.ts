/**
 * Unit tests for Magic-Link JWT helper (order-token.ts).
 *
 * TC-F10-06-07: sign + verify round-trip
 * TC-F10-06-08: tampered / wrong-secret / wrong-scope returns invalid
 * TC-F10-06-09: expired token returns expired
 *
 * Uses Node environment (not jsdom) because jose's native Node ESM build
 * performs `instanceof Uint8Array` checks that fail under jsdom's cross-realm
 * globals. Crypto logic tests have no DOM dependency.
 */
// @vitest-environment node

import { describe, it, expect } from 'vitest'
import { signOrderToken, verifyOrderToken } from '@/lib/auth/order-token'

const SECRET = 'test-secret-at-least-32-chars-long!!'
const ORDER_ID = '42'
const futureExp = () => Math.floor(Date.now() / 1000) + 3600 // 1h from now
const pastExp = () => Math.floor(Date.now() / 1000) - 1      // already expired

// ─── TC-F10-06-07: sign + verify round-trip ────────────────────────────────
describe('signOrderToken + verifyOrderToken — round-trip', () => {
    it('returns { ok: true, orderId } for a valid token', async () => {
        // Arrange
        const token = await signOrderToken({ orderId: ORDER_ID, secret: SECRET, expSec: futureExp() })

        // Act
        const result = await verifyOrderToken({ token, secret: SECRET })

        // Assert
        expect(result.ok).toBe(true)
        if (result.ok) {
            expect(result.orderId).toBe(ORDER_ID)
        }
    })

    it('preserves numeric orderId as string', async () => {
        const token = await signOrderToken({ orderId: 99, secret: SECRET, expSec: futureExp() })
        const result = await verifyOrderToken({ token, secret: SECRET })
        expect(result.ok).toBe(true)
        if (result.ok) expect(result.orderId).toBe('99')
    })
})

// ─── TC-F10-06-08: tampered token → invalid ────────────────────────────────
describe('verifyOrderToken — tampered token', () => {
    it('returns { ok: false, error: "invalid" } for a tampered token', async () => {
        // Arrange
        const token = await signOrderToken({ orderId: ORDER_ID, secret: SECRET, expSec: futureExp() })
        const tampered = token.slice(0, -4) + 'XXXX'

        // Act
        const result = await verifyOrderToken({ token: tampered, secret: SECRET })

        // Assert
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.error).toBe('invalid')
    })
})

// ─── TC-F10-06-09: expired token → expired ─────────────────────────────────
describe('verifyOrderToken — expired token', () => {
    it('returns { ok: false, error: "expired" } for an expired token', async () => {
        // Arrange — sign with expSec already in the past
        const token = await signOrderToken({ orderId: ORDER_ID, secret: SECRET, expSec: pastExp() })

        // Act
        const result = await verifyOrderToken({ token, secret: SECRET })

        // Assert
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.error).toBe('expired')
    })
})

// ─── TC-F10-06-08: wrong secret → invalid ──────────────────────────────────
describe('verifyOrderToken — wrong secret', () => {
    it('returns { ok: false, error: "invalid" } when verified with wrong secret', async () => {
        // Arrange
        const token = await signOrderToken({ orderId: ORDER_ID, secret: SECRET, expSec: futureExp() })

        // Act
        const result = await verifyOrderToken({ token, secret: 'wrong-secret-totally-different!!' })

        // Assert
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.error).toBe('invalid')
    })
})

// ─── TC-F10-06-08: wrong scope → invalid ───────────────────────────────────
describe('verifyOrderToken — wrong scope in payload', () => {
    it('returns { ok: false, error: "invalid" } for token with wrong scope', async () => {
        // Arrange — manually build a JWT with scope !== 'order_upload' using jose directly
        const { SignJWT } = await import('jose')
        const enc = (s: string): Uint8Array => Buffer.from(s, 'utf-8')

        const token = await new SignJWT({ scope: 'admin_access' })
            .setProtectedHeader({ alg: 'HS256' })
            .setSubject(ORDER_ID)
            .setIssuedAt()
            .setExpirationTime(futureExp())
            .sign(enc(SECRET))

        // Act
        const result = await verifyOrderToken({ token, secret: SECRET })

        // Assert
        expect(result.ok).toBe(false)
        if (!result.ok) expect(result.error).toBe('invalid')
    })
})
