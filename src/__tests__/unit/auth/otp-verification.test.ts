import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Users } from '../../../collections/Users'
import { PayloadRequest } from 'payload'

// Mock dependencies
vi.mock('@/lib/email/send', () => ({
    sendEmail: vi.fn().mockResolvedValue({}),
}))

vi.mock('@/lib/otp/generate', () => ({
    generateOTP: vi.fn(() => '123456'),
    hashOTP: vi.fn(() => 'hashed_123456'),
    getOTPExpiry: vi.fn(() => new Date(Date.now() + 5 * 60 * 1000)),
    verifyOTP: vi.fn((otp, hash) => otp === '123456' && hash === 'hashed_123456'),
}))

vi.mock('jose', () => {
    return {
        SignJWT: vi.fn().mockImplementation(() => {
            return {
                setProtectedHeader: vi.fn().mockReturnThis(),
                setIssuedAt: vi.fn().mockReturnThis(),
                setExpirationTime: vi.fn().mockReturnThis(),
                sign: vi.fn().mockResolvedValue('mock_jwt_token'),
            }
        }),
    }
})

describe('OTP Verification Endpoints', () => {
    const endpoints = (Users.endpoints || []) as any[]
    const sendOtpHandler = endpoints.find((e: any) => e.path === '/send-otp')?.handler
    const verifyOtpHandler = endpoints.find((e: any) => e.path === '/verify-otp')?.handler

    let mockPayload: any

    beforeEach(() => {
        vi.clearAllMocks()

        mockPayload = {
            find: vi.fn(),
            update: vi.fn(),
            sendEmail: vi.fn().mockResolvedValue({}),
        }
    })

    const createMockRequest = (body: any) => {
        return {
            json: vi.fn().mockResolvedValue(body),
            payload: mockPayload,
        } as unknown as PayloadRequest
    }

    describe('POST /send-otp', () => {
        it('requires email', async () => {
            const req = createMockRequest({})
            const res = await sendOtpHandler!(req) as Response
            const data = await res.json()

            expect(res.status).toBe(400)
            expect(data.errors[0].message).toBe('Email is required')
        })

        it('returns generic success even if user not found (security)', async () => {
            mockPayload.find.mockResolvedValue({ docs: [] })
            const req = createMockRequest({ email: 'notfound@test.com' })

            const res = await sendOtpHandler!(req) as Response
            const data = await res.json()

            expect(res.status).toBe(200)
            expect(data.message).toContain('If the email exists')
        })

        it('blocks requests within cooldown period (rate limit)', async () => {
            mockPayload.find.mockResolvedValue({
                docs: [{
                    id: 1,
                    email: 'test@test.com',
                    otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
                }]
            })
            const req = createMockRequest({ email: 'test@test.com' })

            const res = await sendOtpHandler!(req) as Response
            const data = await res.json()

            expect(res.status).toBe(429)
            expect(data.errors[0].message).toContain('Please wait before requesting')
        })

        it('generates OTP and updates user', async () => {
            mockPayload.find.mockResolvedValue({
                docs: [{ id: 1, email: 'test@test.com' }] // no previous OTP
            })
            const req = createMockRequest({ email: 'test@test.com' })

            const res = await sendOtpHandler!(req) as Response
            const data = await res.json()

            expect(res.status).toBe(200)
            expect(data.message).toContain('If the email exists')

            expect(mockPayload.update).toHaveBeenCalledWith(expect.objectContaining({
                collection: 'users',
                id: 1,
                data: expect.objectContaining({
                    otpHash: 'hashed_123456',
                    otpAttempts: 0
                })
            }))
        })

        it('returns emailSent: true when sendEmail succeeds [TC-F02.40]', async () => {
            process.env.MAIL_HOST = 'smtp.test.com'
            mockPayload.find.mockResolvedValue({
                docs: [{ id: 1, email: 'test@test.com' }]
            })
            mockPayload.sendEmail.mockResolvedValue({})
            const req = createMockRequest({ email: 'test@test.com' })

            const res = await sendOtpHandler!(req) as Response
            const data = await res.json()

            delete process.env.MAIL_HOST
            expect(res.status).toBe(200)
            expect(data.emailSent).toBe(true)
        })

        it('returns emailSent: false when sendEmail throws [TC-F02.41]', async () => {
            process.env.MAIL_HOST = 'smtp.test.com'
            mockPayload.find.mockResolvedValue({
                docs: [{ id: 1, email: 'test@test.com' }]
            })
            mockPayload.sendEmail.mockRejectedValue(new Error('SMTP connection refused'))
            const req = createMockRequest({ email: 'test@test.com' })

            const res = await sendOtpHandler!(req) as Response
            const data = await res.json()

            delete process.env.MAIL_HOST
            expect(res.status).toBe(200)
            expect(data.emailSent).toBe(false)
        })

        it('normalizes null permission items in multi-tenant user tenants before update [TC-F02.43]', async () => {
            mockPayload.find.mockResolvedValue({
                docs: [{
                    id: 1,
                    email: 'staff@test.com',
                    tenants: [
                        { id: 'ut-1', tenant: 1, role: 'editor', status: 'active', permissions: [] },
                        { id: 'ut-2', tenant: 2, role: 'custom', status: 'active', permissions: [null, 'products'] },
                    ],
                }]
            })
            const req = createMockRequest({ email: 'staff@test.com' })

            const res = await sendOtpHandler!(req) as Response

            expect(res.status).toBe(200)
            expect(mockPayload.update).toHaveBeenCalledWith(expect.objectContaining({
                data: expect.objectContaining({
                    tenants: expect.arrayContaining([
                        expect.objectContaining({ id: 'ut-2', permissions: ['products'] }),
                    ]),
                }),
            }))
        })
    })

    describe('POST /verify-otp', () => {
        it('requires email and otp', async () => {
            const req = createMockRequest({ email: 'test@test.com' }) // missing otp
            const res = await verifyOtpHandler!(req) as Response
            const data = await res.json()

            expect(res.status).toBe(400)
            expect(data.errors[0].message).toBe('Email and OTP are required')
        })

        it('rejects if no OTP requested', async () => {
            mockPayload.find.mockResolvedValue({
                docs: [{ id: 1, email: 'test@test.com' }] // no otpHash
            })
            const req = createMockRequest({ email: 'test@test.com', otp: '123456' })

            const res = await verifyOtpHandler!(req) as Response
            const data = await res.json()

            expect(res.status).toBe(401)
            expect(data.errors[0].message).toContain('No verification code found')
        })

        it('rejects expired OTP', async () => {
            mockPayload.find.mockResolvedValue({
                docs: [{
                    id: 1,
                    email: 'test@test.com',
                    otpHash: 'hashed_123456',
                    // Expired 1 minute ago
                    otpExpiresAt: new Date(Date.now() - 60 * 1000).toISOString()
                }]
            })
            const req = createMockRequest({ email: 'test@test.com', otp: '123456' })

            const res = await verifyOtpHandler!(req) as Response
            const data = await res.json()

            expect(res.status).toBe(401)
            expect(data.errors[0].message).toContain('Code has expired')
        })

        it('rejects invalid OTP and increments attempts', async () => {
            mockPayload.find.mockResolvedValue({
                docs: [{
                    id: 1,
                    email: 'test@test.com',
                    otpHash: 'hashed_123456',
                    otpAttempts: 2,
                    otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
                }]
            })
            const req = createMockRequest({ email: 'test@test.com', otp: 'wrong' })

            const res = await verifyOtpHandler!(req) as Response
            const data = await res.json()

            expect(res.status).toBe(401)
            expect(data.errors[0].message).toBe('Invalid verification code.')

            expect(mockPayload.update).toHaveBeenCalledWith(expect.objectContaining({
                id: 1,
                data: { otpAttempts: 3 }
            }))
        })

        it('accepts correct OTP and clears tokens, returning HttpOnly Cookie', async () => {
            mockPayload.find.mockResolvedValue({
                docs: [{
                    id: 1,
                    email: 'test@test.com',
                    otpHash: 'hashed_123456',
                    otpAttempts: 0,
                    otpExpiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
                }]
            })
            const req = createMockRequest({ email: 'test@test.com', otp: '123456' })

            const res = (await verifyOtpHandler!(req)) as unknown as Response

            expect(res.status).toBe(200)
            expect(mockPayload.update).toHaveBeenCalledWith(expect.objectContaining({
                id: 1,
                data: expect.objectContaining({
                    otpHash: '',
                    otpExpiresAt: null,
                    otpAttempts: 0
                })
            }))

            const setCookie = res.headers.get('Set-Cookie')
            expect(setCookie).toContain('payload-token=mock_jwt_token')
            expect(setCookie).toContain('HttpOnly')
            expect(setCookie).toContain('Path=/')
        })
    })

    // ── TC-F02.19: E2E Test OTP Bypass ──────────────────────────────
    describe('E2E test OTP bypass', () => {
        const TEST_EMAIL = 'e2e@test.com'
        const TEST_OTP = '999999'

        beforeEach(() => {
            vi.stubEnv('E2E_TEST_OTP_CODE', TEST_OTP)
            vi.stubEnv('TEST_EMAIL', TEST_EMAIL)
            vi.stubEnv('APP_ENV', 'staging')
        })

        afterEach(() => {
            vi.unstubAllEnvs()
        })

        it('bypasses OTP hash check for matching test email + code on staging', async () => {
            mockPayload.find.mockResolvedValue({
                docs: [{ id: 1, email: TEST_EMAIL, otpAttempts: 0 }] // no otpHash
            })
            const req = createMockRequest({ email: TEST_EMAIL, otp: TEST_OTP })

            const res = (await verifyOtpHandler!(req)) as unknown as Response
            expect(res.status).toBe(200)

            const setCookie = res.headers.get('Set-Cookie')
            expect(setCookie).toContain('payload-token=')
        })

        it('rejects the fixed E2E OTP outside staging', async () => {
            // Arrange
            vi.stubEnv('APP_ENV', 'production')
            mockPayload.find.mockResolvedValue({
                docs: [{ id: 1, email: TEST_EMAIL, otpAttempts: 0 }]
            })
            const req = createMockRequest({ email: TEST_EMAIL, otp: TEST_OTP })

            // Act
            const res = (await verifyOtpHandler!(req)) as unknown as Response

            // Assert
            expect(res.status).toBe(401)
        })

        it('rejects bypass when OTP code does not match', async () => {
            mockPayload.find.mockResolvedValue({
                docs: [{ id: 1, email: TEST_EMAIL, otpAttempts: 0 }]
            })
            const req = createMockRequest({ email: TEST_EMAIL, otp: 'wrong' })

            const res = await verifyOtpHandler!(req) as Response
            expect(res.status).toBe(401)
        })

        it('rejects bypass when email does not match TEST_EMAIL', async () => {
            mockPayload.find.mockResolvedValue({
                docs: [{ id: 1, email: 'other@test.com', otpAttempts: 0 }]
            })
            const req = createMockRequest({ email: 'other@test.com', otp: TEST_OTP })

            const res = await verifyOtpHandler!(req) as Response
            expect(res.status).toBe(401)
        })

        it('rejects bypass when E2E_TEST_OTP_CODE env is not set', async () => {
            vi.stubEnv('E2E_TEST_OTP_CODE', '')
            mockPayload.find.mockResolvedValue({
                docs: [{ id: 1, email: TEST_EMAIL, otpAttempts: 0 }]
            })
            const req = createMockRequest({ email: TEST_EMAIL, otp: TEST_OTP })

            const res = await verifyOtpHandler!(req) as Response
            expect(res.status).toBe(401)
        })
    })
})
