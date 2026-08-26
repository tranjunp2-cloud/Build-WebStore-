import { describe, it, expect } from 'vitest'
import { staffInvitationEmail } from '@/lib/email/templates/staff-invitation'

// ─── TC-F19: Staff invitation email template ──────────────────────────

describe('staffInvitationEmail [TC-F19]', () => {
    it('returns subject with workspace name', () => {
        const result = staffInvitationEmail({
            userName: 'John',
            workspaceName: 'My Shop',
        })
        expect(result.subject).toContain('My Shop')
        expect(result.subject).toContain('invited')
    })

    it('returns HTML with user name', () => {
        const result = staffInvitationEmail({
            userName: 'John',
            workspaceName: 'My Shop',
        })
        expect(result.html).toContain('John')
    })

    it('returns HTML with workspace name', () => {
        const result = staffInvitationEmail({
            userName: 'John',
            workspaceName: 'My Shop',
        })
        expect(result.html).toContain('My Shop')
    })

    it('uses default login URL when not provided', () => {
        const result = staffInvitationEmail({
            userName: 'John',
            workspaceName: 'My Shop',
        })
        expect(result.html).toContain('https://primeweb.app/login')
    })

    it('uses custom login URL when provided', () => {
        const result = staffInvitationEmail({
            userName: 'John',
            workspaceName: 'My Shop',
            loginUrl: 'https://custom.app/login',
        })
        expect(result.html).toContain('https://custom.app/login')
    })

    it('defaults to English locale', () => {
        const result = staffInvitationEmail({
            userName: 'John',
            workspaceName: 'My Shop',
        })
        expect(result.html).toContain('lang="en"')
    })

    it('uses provided locale', () => {
        const result = staffInvitationEmail({
            userName: 'John',
            workspaceName: 'My Shop',
            locale: 'ms',
        })
        expect(result.html).toContain('lang="ms"')
    })

    it('includes CTA button', () => {
        const result = staffInvitationEmail({
            userName: 'John',
            workspaceName: 'My Shop',
        })
        expect(result.html).toContain('Log In to Accept')
    })

    it('includes copyright footer', () => {
        const result = staffInvitationEmail({
            userName: 'John',
            workspaceName: 'My Shop',
        })
        expect(result.html).toContain('Web Store')
        expect(result.html).toContain('2026')
    })

    it('returns valid HTML document structure', () => {
        const result = staffInvitationEmail({
            userName: 'Test',
            workspaceName: 'Shop',
        })
        expect(result.html).toContain('<!DOCTYPE html>')
        expect(result.html).toContain('</html>')
    })
})
