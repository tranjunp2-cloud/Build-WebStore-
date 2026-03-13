/**
 * Lark Bot — Cryptographic Utilities
 * Event signature verification (HMAC-SHA256) + AES-256-CBC decrypt
 *
 * Docs: https://open.larksuite.com/document/server-docs/event-subscription/event-subscription-configure-/request-url-configuration-case
 */
import { createHmac, createDecipheriv, createHash } from 'crypto'
import { LARK_ENCRYPT_KEY, LARK_VERIFICATION_TOKEN } from './constants'

// ─── Signature Verification ──────────────────────────────────────────────

/**
 * Verify event callback signature
 * signature = sha256(timestamp + nonce + encrypt_key + body)
 */
export function verifyEventSignature(
    timestamp: string,
    nonce: string,
    encryptKey: string,
    body: string,
    signature: string
): boolean {
    if (!timestamp || !nonce || !signature) return false

    const content = timestamp + nonce + encryptKey + body
    const computed = createHash('sha256').update(content).digest('hex')

    // Constant-time comparison to prevent timing attacks
    if (computed.length !== signature.length) return false

    const a = Buffer.from(computed, 'utf8')
    const b = Buffer.from(signature, 'utf8')

    let diff = 0
    for (let i = 0; i < a.length; i++) {
        diff |= a[i] ^ b[i]
    }

    return diff === 0
}

/**
 * Verify signature from request headers
 * Headers: X-Lark-Request-Timestamp, X-Lark-Request-Nonce, X-Lark-Signature
 */
export function verifyRequestSignature(
    headers: Headers,
    rawBody: string
): boolean {
    const encryptKey = LARK_ENCRYPT_KEY
    if (!encryptKey) {
        // No encrypt key configured — skip verification (dev mode)
        console.warn('[Lark] No LARK_ENCRYPT_KEY — skipping signature verification')
        return true
    }

    const timestamp = headers.get('x-lark-request-timestamp') || ''
    const nonce = headers.get('x-lark-request-nonce') || ''
    const signature = headers.get('x-lark-signature') || ''

    return verifyEventSignature(timestamp, nonce, encryptKey, rawBody, signature)
}

// ─── AES Decrypt ─────────────────────────────────────────────────────────

/**
 * Decrypt AES-256-CBC encrypted event body
 * Lark encrypts event payloads when Encrypt Key is configured
 *
 * Algorithm:
 * 1. key = SHA256(encrypt_key)
 * 2. iv = first 16 bytes of encrypted data
 * 3. Decrypt remaining bytes with AES-256-CBC
 * 4. Remove PKCS7 padding
 */
export function decryptEvent(encryptedBase64: string, encryptKey?: string): string {
    const key = encryptKey || LARK_ENCRYPT_KEY
    if (!key) {
        throw new Error('LARK_ENCRYPT_KEY is required for decryption')
    }

    // SHA256 of encrypt key as AES key (32 bytes)
    const aesKey = createHash('sha256').update(key).digest()

    // Decode base64
    const encrypted = Buffer.from(encryptedBase64, 'base64')

    // First 16 bytes = IV
    const iv = encrypted.subarray(0, 16)
    const ciphertext = encrypted.subarray(16)

    // Decrypt
    const decipher = createDecipheriv('aes-256-cbc', aesKey, iv)
    let decrypted = decipher.update(ciphertext, undefined, 'utf8')
    decrypted += decipher.final('utf8')

    return decrypted
}

// ─── Token Verification ──────────────────────────────────────────────────

/**
 * Verify the token in event payload matches our verification token
 * This is a simple check — separate from signature verification
 */
export function verifyToken(token: string): boolean {
    const expected = LARK_VERIFICATION_TOKEN
    if (!expected) {
        console.warn('[Lark] No LARK_VERIFICATION_TOKEN — skipping token verification')
        return true
    }
    return token === expected
}

// ─── Card Action Signature ───────────────────────────────────────────────

/**
 * Verify card action callback signature
 * Used for interactive card button callbacks
 */
export function verifyCardActionToken(token: string): boolean {
    return verifyToken(token)
}
