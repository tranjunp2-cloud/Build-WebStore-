import { describe, it, expect, vi } from 'vitest'
import { Users } from '../../collections/Users'
import type { PayloadRequest } from 'payload'

type MockReq = Pick<PayloadRequest, 'json' | 'payload'>

describe('Payload Custom Endpoint: /api/users/login', () => {
    const endpoints = Array.isArray(Users.endpoints) ? Users.endpoints : []
    const loginEndpoint = endpoints.find((e: any) => e.path === '/login')
    const handler = loginEndpoint?.handler

    if (!handler) {
        throw new Error('Login handler not found')
    }

    it('returns 400 for empty email or password', async () => {
        const req = {
            json: vi.fn().mockResolvedValue({ email: '', password: 'password123' }),
            payload: { login: vi.fn() }
        } as unknown as PayloadRequest

        const res = await handler(req as unknown as PayloadRequest)
        const body = await res.json()
        expect(res.status).toBe(400)
        expect(body.errors[0].message).toBe('Email and password are required')
        
        // both empty
        const req2 = {
            json: vi.fn().mockResolvedValue({ email: '', password: '' }),
            payload: { login: vi.fn() }
        } as unknown as PayloadRequest
        const res2 = await handler(req2 as unknown as PayloadRequest)
        const body2 = await res2.json()
        expect(res2.status).toBe(400)
        expect(body2.errors[0].message).toBe('Email and password are required')
    })

    it('returns 400 for invalid email format', async () => {
        const req = {
            json: vi.fn().mockResolvedValue({ email: 'invalid-email', password: 'password123' }),
            payload: { login: vi.fn() }
        } as unknown as PayloadRequest

        const res = await handler(req as unknown as PayloadRequest)
        const body = await res.json()
        expect(res.status).toBe(400)
        expect(body.errors[0].message).toBe('Invalid email format')
        
        // Malicious SQL injection payload disguised as email
        const reqSql = {
            json: vi.fn().mockResolvedValue({ email: "admin' --", password: 'password123' }),
            payload: { login: vi.fn() }
        } as unknown as PayloadRequest
        const resSql = await handler(reqSql as unknown as PayloadRequest)
        const bodySql = await resSql.json()
        expect(resSql.status).toBe(400)
        expect(bodySql.errors[0].message).toBe('Invalid email format')
    })

    it('processes valid email and returns auth result', async () => {
        const mockPayloadLogin = vi.fn().mockResolvedValue({
            user: { id: 'user-1', email: 'test@example.com' },
            token: 'valid-token'
        })
        const req = {
            json: vi.fn().mockResolvedValue({ email: 'test@example.com', password: 'password123' }),
            payload: { login: mockPayloadLogin }
        } as unknown as PayloadRequest

        const res = await handler(req)
        
        expect(mockPayloadLogin).toHaveBeenCalledWith({
            collection: 'users',
            data: { email: 'test@example.com', password: 'password123' }
        })
        
        // Since we return standard Response, we can check its properties
        expect(res.status).toBe(200)
        
        const body = await res.json()
        expect(body.message).toBe('Auth Passed')
        expect(body.token).toBe('valid-token')
        expect(body.user.email).toBe('test@example.com')
        
        // Verify Set-Cookie header is assigned
        expect(res.headers.get('Set-Cookie')).toContain('payload-token=valid-token')
    })
    
    it('returns 401 and masks internal errors from payload.login', async () => {
        const mockPayloadLogin = vi.fn().mockRejectedValue(new Error('Internal raw database connection error'))
        const req = {
            json: vi.fn().mockResolvedValue({ email: 'test@example.com', password: 'wrongpassword' }),
            payload: { login: mockPayloadLogin }
        } as unknown as PayloadRequest

        const res = await handler(req)
        const body = await res.json()
        
        expect(res.status).toBe(401)
        expect(body.errors[0].message).toBe('Login failed') // Should not be 'Internal raw database connection error'
    })
})
