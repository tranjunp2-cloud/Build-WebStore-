/**
 * TC-AICP-214 / TC-AICP-215 — what the Contact leads page shows and stores of the replies the shop sent:
 *   214  `mapContactSubmission` carries the replies (bad rows dropped), and the detail panel lists each sent reply
 *        under the message it answered (subject, body, date), read-only
 *   215  the `replies` array field and its db-setup migration follow the array-table convention
 *        (varchar id, `_order`, `_parent_id`, `_uuid`; one column per field; no DROP TABLE)
 * Real: customer-record.ts, customer-detail-panel.tsx, ContactSubmissions.ts, scripts/db-setup.js MIGRATIONS.
 * Faked: the page's server actions, the i18n hook.
 */

import { createRequire } from 'node:module'
import { render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'

const h = vi.hoisted(() => ({ timeline: [] as unknown[] }))

vi.mock('@/i18n', () => ({ useI18n: () => ({ t: en }) }))
vi.mock('@/app/(dashboard)/contact-leads/actions', () => ({
    getCustomerDetailAction: vi.fn(async () => ({ timeline: h.timeline })),
    updateContactStatusAction: vi.fn(async () => ({})),
}))
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

import { CustomerDetailPanel } from '@/app/(dashboard)/contact-leads/_components/customer-detail-panel'
import { mapContactSubmission } from '@/app/(dashboard)/contact-leads/_lib/customer-record'
import { ContactSubmissions } from '@/collections/ContactSubmissions'

const nodeRequire = createRequire(import.meta.url)
const { MIGRATIONS } = nodeRequire('../../../../scripts/db-setup.js') as { MIGRATIONS: Array<{ name: string; sql: string }> }

const doc = (over: Record<string, unknown> = {}) => ({ id: 1, name: 'Ahmad', email: 'ahmad@x.my', message: 'Do you ship to Sabah?', status: 'read', site: 5, createdAt: '2026-10-10T08:00:00.000Z', ...over })
const reply = { id: 'r1', subject: 'Re: shipping', body: 'Yes, we ship to Sabah.\nRegards, Kedai Batik', sentAt: '2026-10-11T09:30:00.000Z', sentBy: 'owner@kedai.my' }

describe('replies on the Contact leads page [TC-AICP-214]', () => {
    it('maps the replies of a message and drops rows that are not a sent reply', () => {
        const record = mapContactSubmission(doc({ replies: [reply, { id: 'r2', subject: 'no body' }, { id: 'r3', subject: 's', body: 'b' }, null] }))

        expect(record.replies).toEqual([{ subject: 'Re: shipping', body: 'Yes, we ship to Sabah.\nRegards, Kedai Batik', sentAt: '2026-10-11T09:30:00.000Z', sentBy: 'owner@kedai.my' }])
        expect(mapContactSubmission(doc()).replies).toEqual([])
        expect(mapContactSubmission(doc({ replies: 'x' })).replies).toEqual([])
    })

    describe('detail panel', () => {
        beforeEach(() => {
            h.timeline = [mapContactSubmission(doc({ replies: [reply] })), mapContactSubmission(doc({ id: 2, message: 'Earlier question', createdAt: '2026-10-09T08:00:00.000Z' }))]
        })

        it('lists the reply under the message it answered: label, subject and text, read-only', async () => {
            render(<CustomerDetailPanel record={mapContactSubmission(doc())} onClose={vi.fn()} onStatusUpdate={vi.fn()} />)

            await waitFor(() => expect(screen.getByText('Do you ship to Sabah?')).toBeInTheDocument())
            expect(screen.getByText(en.dashboard.customers.replySent)).toBeInTheDocument()
            expect(screen.getByText('Re: shipping')).toBeInTheDocument()
            expect(screen.getByText(/Yes, we ship to Sabah\./)).toBeInTheDocument()
            // one reply on the page: the message without replies shows none
            expect(screen.getAllByText(en.dashboard.customers.replySent)).toHaveLength(1)
            // read-only: nothing to type into besides the status control
            expect(screen.queryByRole('textbox')).toBeNull()
        })

        it('has the label in both languages of the dashboard', () => {
            expect(en.dashboard.customers.replySent).toBe('Reply sent')
            expect(ms.dashboard.customers.replySent).toBe('Balasan dihantar')
        })
    })
})

describe('replies field and migration [TC-AICP-215]', () => {
    const field = ContactSubmissions.fields.find((f) => 'name' in f && f.name === 'replies') as { type: string; fields: Array<{ name: string; type: string }>; admin?: { readOnly?: boolean } }
    const sqlOf = (name: string) => MIGRATIONS.find((m) => m.name === name)?.sql ?? ''

    it('is a read-only array of subject, body, sentAt, sentBy', () => {
        expect(field.type).toBe('array')
        expect(field.admin?.readOnly).toBe(true)
        expect(field.fields.map((f) => [f.name, f.type])).toEqual([['subject', 'text'], ['body', 'textarea'], ['sentAt', 'date'], ['sentBy', 'text']])
    })

    it('has an array table for it: varchar id, _order, _parent_id, _uuid and one column per field, never dropped', () => {
        const create = sqlOf('contact_submissions_replies.create_table')

        expect(create).toMatch(/CREATE TABLE IF NOT EXISTS contact_submissions_replies/)
        expect(create).toMatch(/id varchar PRIMARY KEY/)
        expect(create).toMatch(/_order integer NOT NULL/)
        expect(create).toMatch(/_parent_id integer NOT NULL/)
        expect(create).toMatch(/_uuid varchar NOT NULL/)
        for (const column of ['subject varchar', 'body varchar', 'sent_at timestamp(3) with time zone', 'sent_by varchar']) {
            expect(create).toContain(column)
            expect(sqlOf('contact_submissions_replies.alter_columns')).toContain(`ADD COLUMN IF NOT EXISTS ${column}`)
        }
        expect(sqlOf('contact_submissions_replies.indexes')).toMatch(/_parent_id_idx[\s\S]*_order_idx|_order_idx[\s\S]*_parent_id_idx/)
        expect(MIGRATIONS.some((m) => /DROP\s+TABLE/i.test(m.sql) && /contact_submissions_replies/.test(m.sql))).toBe(false)
        expect(MIGRATIONS.filter((m) => m.name.startsWith('contact_submissions_replies.')).map((m) => m.name)).toEqual(['contact_submissions_replies.create_table', 'contact_submissions_replies.alter_columns', 'contact_submissions_replies.indexes'])
    })
})
