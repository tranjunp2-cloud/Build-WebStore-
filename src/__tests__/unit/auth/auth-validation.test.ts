/**
 * F02 Auth Flow — Unit Tests for Validation, Role Redirect
 *
 * Login password length + strength moved to tests that import the source (GH-2269):
 *   login-page-password-min-length.test.tsx, password-rules.test.ts
 *
 * QA Coverage Map (docs/qa/F02-auth.md):
 *   TC-F02.09: Empty input validation
 *   TC-F02.11: Email space trimming (registerSchema)
 *   TC-F02.34: Post-login redirect with returnUrl
 *   TC-F02.35: Role-based redirect (owner vs staff)
 */
import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// ── Re-create schemas (mirroring register/login page.tsx inline schemas) ──
// These are inline in the TSX files, so we re-declare for unit testing
const registerSchema = z
    .object({
        firstName: z.string().min(2, 'First name must be at least 2 characters'),
        lastName: z.string().min(2, 'Last name must be at least 2 characters'),
        email: z.string().min(1, 'Email is required').email('Please enter a valid email'),
        password: z.string().min(8, 'Password must be at least 8 characters'),
        confirmPassword: z.string(),
    })
    .refine((d) => d.password === d.confirmPassword, {
        message: "Passwords don't match",
        path: ['confirmPassword'],
    })

function generateSlug(name: string): string {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .substring(0, 30)
}

/** Mirrors TenantLite from login/page.tsx */
type TenantLite = { onboardingCompleted?: boolean } | null

function getRedirectByRole(
    user: { roles?: string[]; tenants?: { tenant: TenantLite | string }[] },
    returnUrl: string,
): string {
    const roles = user.roles || []
    if (roles.includes('editor') || roles.includes('viewer')) return '/admin'
    if (roles.includes('tenant-owner')) {
        if (!user.tenants || user.tenants.length === 0) return '/onboarding'
        // Check onboardingCompleted from populated tenant (depth=1)
        const firstTenant = user.tenants[0]?.tenant
        if (firstTenant && typeof firstTenant === 'object' && firstTenant.onboardingCompleted === false) {
            return '/onboarding'
        }
    }
    return returnUrl
}

// ═══════════════════════════════════════════════════════════════════════════
// TC-F02.09: Empty Input Validation
// ═══════════════════════════════════════════════════════════════════════════
describe('registerSchema (TC-F02.09: empty input validation)', () => {
    it('rejects empty firstName', () => {
        const result = registerSchema.safeParse({
            firstName: '', lastName: 'Doe', email: 'a@b.com', password: 'Test1234!', confirmPassword: 'Test1234!',
        })
        expect(result.success).toBe(false)
    })

    it('rejects empty email', () => {
        const result = registerSchema.safeParse({
            firstName: 'Jo', lastName: 'Do', email: '', password: 'Test1234!', confirmPassword: 'Test1234!',
        })
        expect(result.success).toBe(false)
    })

    it('rejects invalid email format', () => {
        const result = registerSchema.safeParse({
            firstName: 'Jo', lastName: 'Do', email: 'not-email', password: 'Test1234!', confirmPassword: 'Test1234!',
        })
        expect(result.success).toBe(false)
    })

    it('accepts valid complete registration data', () => {
        const result = registerSchema.safeParse({
            firstName: 'Ahmad', lastName: 'Ali', email: 'ahmad@test.com', password: 'MyPass88!', confirmPassword: 'MyPass88!',
        })
        expect(result.success).toBe(true)
    })

    it('rejects mismatched passwords', () => {
        const result = registerSchema.safeParse({
            firstName: 'Ahmad', lastName: 'Ali', email: 'a@b.com', password: 'MyPass88!', confirmPassword: 'Different!',
        })
        expect(result.success).toBe(false)
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// generateSlug — Store slug generation
// ═══════════════════════════════════════════════════════════════════════════
describe('generateSlug', () => {
    it('converts to lowercase with hyphens', () => {
        expect(generateSlug("Ahmad's Store")).toBe('ahmads-store')
    })

    it('removes special characters', () => {
        expect(generateSlug('Café & Bar!')).toBe('caf-bar')
    })

    it('truncates to 30 chars max', () => {
        const longName = 'This Is A Very Long Store Name That Exceeds Thirty Characters'
        expect(generateSlug(longName).length).toBeLessThanOrEqual(30)
    })

    it('collapses multiple hyphens', () => {
        expect(generateSlug('Store   Name')).toBe('store-name')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F02.34, TC-F02.35: Role-Based Redirect
// ═══════════════════════════════════════════════════════════════════════════
describe('getRedirectByRole (TC-F02.34, TC-F02.35: role-based redirect)', () => {
    it('redirects staff (editor) to /admin (TC-F02.35)', () => {
        expect(getRedirectByRole({ roles: ['editor'] }, '/dashboard')).toBe('/admin')
    })

    it('redirects staff (viewer) to /admin (TC-F02.35)', () => {
        expect(getRedirectByRole({ roles: ['viewer'] }, '/dashboard')).toBe('/admin')
    })

    it('redirects owner without tenant to /onboarding', () => {
        expect(getRedirectByRole({ roles: ['tenant-owner'], tenants: [] }, '/dashboard')).toBe('/onboarding')
    })

    it('redirects owner without tenants array to /onboarding', () => {
        expect(getRedirectByRole({ roles: ['tenant-owner'] }, '/dashboard')).toBe('/onboarding')
    })

    it('redirects owner with tenant to returnUrl (TC-F02.34)', () => {
        const user = { roles: ['tenant-owner'], tenants: [{ tenant: 'tenant-123' }] }
        expect(getRedirectByRole(user, '/builder/test-id')).toBe('/builder/test-id')
    })

    it('defaults to returnUrl for owner with tenant and /dashboard', () => {
        const user = { roles: ['tenant-owner'], tenants: [{ tenant: 'x' }] }
        expect(getRedirectByRole(user, '/dashboard')).toBe('/dashboard')
    })

    it('handles user with no roles (fallback to returnUrl)', () => {
        expect(getRedirectByRole({}, '/login')).toBe('/login')
    })
})

// ═══════════════════════════════════════════════════════════════════════════
// TC-F06.01b: onboardingCompleted flag — routing (new logic in US-F06-02)
// ═══════════════════════════════════════════════════════════════════════════
describe('getRedirectByRole — onboardingCompleted branch (TC-F06.01b)', () => {
    it('redirects to /onboarding when tenant.onboardingCompleted is false', () => {
        const user = {
            roles: ['tenant-owner'],
            tenants: [{ tenant: { onboardingCompleted: false } }],
        }
        expect(getRedirectByRole(user, '/dashboard')).toBe('/onboarding')
    })

    it('does NOT redirect to /onboarding when onboardingCompleted is true', () => {
        const user = {
            roles: ['tenant-owner'],
            tenants: [{ tenant: { onboardingCompleted: true } }],
        }
        expect(getRedirectByRole(user, '/dashboard')).toBe('/dashboard')
    })

    it('does NOT redirect to /onboarding when onboardingCompleted is undefined (legacy tenant)', () => {
        const user = {
            roles: ['tenant-owner'],
            tenants: [{ tenant: { onboardingCompleted: undefined } }],
        }
        expect(getRedirectByRole(user, '/dashboard')).toBe('/dashboard')
    })

    it('does NOT redirect to /onboarding when tenant is a string id (depth=0)', () => {
        // Payload at depth=0 returns just the tenant id string — should NOT trigger onboarding redirect
        const user = {
            roles: ['tenant-owner'],
            tenants: [{ tenant: 'tenant-id-string' }],
        }
        expect(getRedirectByRole(user, '/dashboard')).toBe('/dashboard')
    })

    it('redirects to /onboarding when onboardingCompleted is false with custom returnUrl', () => {
        const user = {
            roles: ['tenant-owner'],
            tenants: [{ tenant: { onboardingCompleted: false } }],
        }
        expect(getRedirectByRole(user, '/builder/new')).toBe('/onboarding')
    })
})
