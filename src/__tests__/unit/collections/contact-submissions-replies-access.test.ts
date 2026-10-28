/**
 * TC-AICP-258 (M5) — ContactSubmissions: `create` is public (anyone can POST /api/contact-submissions), so the
 * `replies` field — the "Reply sent" records the dashboard shows and the copilot reads as already answered — must be
 * closed to every request on create AND update. Only lib/leads/lead-reply.ts writes it, through the Local API
 * (overrideAccess), which field access does not apply to. The live proof (a real REST POST with `replies`) is in
 * plans/261021-ai-release-on-staging/reports/fix-review-ops-money.md.
 */
import type { ArrayField, Field } from 'payload'
import { describe, expect, it } from 'vitest'
import { ContactSubmissions } from '@/collections/ContactSubmissions'

const field = (name: string) => ContactSubmissions.fields.find((f: Field) => 'name' in f && f.name === name)

describe('ContactSubmissions replies field access [TC-AICP-258]', () => {
    const replies = field('replies') as ArrayField

    it('is an array field that no request may create or update, whoever asks (visitor, staff, super-admin)', async () => {
        expect(replies.type).toBe('array')
        const access = replies.access!
        const asVisitor = { req: { user: null } } as never
        const asSuperAdmin = { req: { user: { id: 1, roles: ['super-admin'] } } } as never

        expect(await access.create!(asVisitor)).toBe(false)
        expect(await access.update!(asVisitor)).toBe(false)
        expect(await access.create!(asSuperAdmin)).toBe(false)
        expect(await access.update!(asSuperAdmin)).toBe(false)
    })

    it('leaves the contact form fields writable by the public create (the form still works)', () => {
        for (const name of ['name', 'email', 'phone', 'subject', 'message', 'site']) {
            expect((field(name) as { access?: unknown }).access).toBeUndefined()
        }
        expect(ContactSubmissions.access!.create).toBeTypeOf('function')
        expect((ContactSubmissions.access!.create as () => boolean)()).toBe(true)
    })

    it('keeps the record shape the panel and the copilot read', () => {
        expect(replies.fields.map((f) => ('name' in f ? f.name : ''))).toEqual(['subject', 'body', 'sentAt', 'sentBy'])
    })
})
