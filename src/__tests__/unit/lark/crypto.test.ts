import { describe, it, expect } from 'vitest'
import { createHash, createCipheriv, randomBytes } from 'crypto'
import { verifyEventSignature, decryptEvent } from '@/lib/lark/crypto'

describe('Lark Crypto', () => {
    describe('verifyEventSignature', () => {
        const encryptKey = 'test-encrypt-key-123'
        const timestamp = '1616000000'
        const nonce = 'test-nonce-abc'
        const body = '{"hello":"world"}'

        function computeExpectedSignature(ts: string, n: string, key: string, b: string): string {
            return createHash('sha256').update(ts + n + key + b).digest('hex')
        }

        it('should verify a valid signature', () => {
            const signature = computeExpectedSignature(timestamp, nonce, encryptKey, body)
            expect(verifyEventSignature(timestamp, nonce, encryptKey, body, signature)).toBe(true)
        })

        it('should reject an invalid signature', () => {
            expect(verifyEventSignature(timestamp, nonce, encryptKey, body, 'invalid-sig')).toBe(false)
        })

        it('should reject when timestamp is different', () => {
            const signature = computeExpectedSignature(timestamp, nonce, encryptKey, body)
            expect(verifyEventSignature('9999999999', nonce, encryptKey, body, signature)).toBe(false)
        })

        it('should reject when nonce is different', () => {
            const signature = computeExpectedSignature(timestamp, nonce, encryptKey, body)
            expect(verifyEventSignature(timestamp, 'wrong-nonce', encryptKey, body, signature)).toBe(false)
        })

        it('should reject when body is different', () => {
            const signature = computeExpectedSignature(timestamp, nonce, encryptKey, body)
            expect(verifyEventSignature(timestamp, nonce, encryptKey, '{"tampered":true}', signature)).toBe(false)
        })

        it('should return false for empty inputs', () => {
            expect(verifyEventSignature('', '', encryptKey, body, 'abc')).toBe(false)
        })
    })

    describe('decryptEvent', () => {
        const encryptKey = 'my-test-encrypt-key'

        function encrypt(plaintext: string, key: string): string {
            const aesKey = createHash('sha256').update(key).digest()
            const iv = randomBytes(16)
            const cipher = createCipheriv('aes-256-cbc', aesKey, iv)
            let encrypted = cipher.update(plaintext, 'utf8')
            encrypted = Buffer.concat([encrypted, cipher.final()])
            return Buffer.concat([iv, encrypted]).toString('base64')
        }

        it('should decrypt an encrypted event body', () => {
            const original = '{"event_type":"im.message.receive_v1","data":"test"}'
            const encrypted = encrypt(original, encryptKey)
            const decrypted = decryptEvent(encrypted, encryptKey)
            expect(decrypted).toBe(original)
        })

        it('should decrypt JSON with unicode content', () => {
            const original = '{"text":"Xin chào team PrimeWeb!"}'
            const encrypted = encrypt(original, encryptKey)
            const decrypted = decryptEvent(encrypted, encryptKey)
            expect(decrypted).toBe(original)
        })

        it('should throw for invalid base64', () => {
            expect(() => decryptEvent('not-valid-base64!!!', encryptKey)).toThrow()
        })

        it('should throw for wrong key', () => {
            const original = '{"test":"data"}'
            const encrypted = encrypt(original, encryptKey)
            expect(() => decryptEvent(encrypted, 'wrong-key')).toThrow()
        })
    })
})
