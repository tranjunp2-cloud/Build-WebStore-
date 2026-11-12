/**
 * An in-memory Payload stand-in for the customer-tool tests: collections as arrays, the `where` shapes the code
 * under test uses (equals / in / exists, and / or), sort by createdAt, and writes that bump `updatedAt`.
 * The raw SQL of the customers list goes to `sqlLog` and answers with the rows a test sets. The lead-reply append
 * (lib/leads/lead-reply `appendLeadReply`: lock + bump the lead, insert one `contact_submissions_replies` row) is
 * stored on the in-memory lead; its real SQL runs on PostgreSQL in integration/lead-reply-append-postgres.test.ts.
 */
import { PgDialect } from 'drizzle-orm/pg-core'
import { vi } from 'vitest'

export type Doc = Record<string, unknown> & { id: number }
export type Db = {
    customers: Doc[]
    orders: Doc[]
    sites: Doc[]
    'contact-submissions': Doc[]
    'email-template-settings': Doc[]
    sqlRows: Array<Record<string, unknown>>
    sqlLog: Array<{ sql: string; params: unknown[] }>
    writes: Array<{ op: 'update' | 'create' | 'delete'; collection: string; id?: number; data?: Record<string, unknown> }>
    clock: number
    nextId: number
    failUpdate?: (collection: string, id: number, data: Record<string, unknown>) => unknown
}

export const newDb = (): Db => ({ customers: [], orders: [], sites: [], 'contact-submissions': [], 'email-template-settings': [], sqlRows: [], sqlLog: [], writes: [], clock: 0, nextId: 1000 })

const idOf = (value: unknown): string => String(value && typeof value === 'object' ? (value as { id?: unknown }).id : value)

function test(doc: Doc, where: Record<string, unknown> | undefined): boolean {
    if (!where) return true
    return Object.entries(where).every(([key, cond]) => {
        if (key === 'and') return (cond as Array<Record<string, unknown>>).every((c) => test(doc, c))
        if (key === 'or') return (cond as Array<Record<string, unknown>>).some((c) => test(doc, c))
        const c = cond as { equals?: unknown; in?: unknown[]; exists?: boolean }
        const v = doc[key]
        if ('equals' in c) return idOf(v) === idOf(c.equals)
        if ('in' in c) return (c.in ?? []).map(idOf).includes(idOf(v))
        if ('exists' in c) return (v !== undefined && v !== null) === c.exists
        return true
    })
}

export function makeCms(db: Db) {
    const tick = () => `u${++db.clock}`
    const list = (collection: string) => (db as unknown as Record<string, Doc[]>)[collection]!
    const cms = {
        find: vi.fn(async ({ collection, where, sort, limit }: { collection: string; where?: Record<string, unknown>; sort?: string; limit?: number }) => {
            let docs = list(collection).filter((d) => test(d, where))
            if (sort) {
                const key = sort.replace(/^-/, '')
                docs = [...docs].sort((a, b) => String(a[key]).localeCompare(String(b[key])) * (sort.startsWith('-') ? -1 : 1))
            }
            const page = docs.slice(0, limit ?? 10).map((d) => structuredClone(d))
            return { docs: page, totalDocs: docs.length }
        }),
        findByID: vi.fn(async ({ collection, id, disableErrors }: { collection: string; id: number; disableErrors?: boolean }) => {
            const doc = list(collection).find((d) => d.id === Number(id))
            if (!doc) {
                if (disableErrors) return null
                throw new Error('Not Found')
            }
            return structuredClone(doc)
        }),
        update: vi.fn(async ({ collection, id, data }: { collection: string; id: number; data: Record<string, unknown> }) => {
            const refusal = db.failUpdate?.(collection, id, data)
            if (refusal) throw refusal
            const doc = list(collection).find((d) => d.id === Number(id))
            if (!doc) throw new Error('Not Found')
            Object.assign(doc, data, { updatedAt: tick() })
            db.writes.push({ op: 'update', collection, id: Number(id), data })
            return structuredClone(doc)
        }),
        create: vi.fn(async ({ collection, data }: { collection: string; data: Record<string, unknown> }) => {
            const doc = { id: db.nextId++, ...data, updatedAt: tick() } as Doc
            list(collection).push(doc)
            db.writes.push({ op: 'create', collection, id: doc.id, data })
            return structuredClone(doc)
        }),
        delete: vi.fn(async ({ collection, id }: { collection: string; id: number }) => {
            const rows = list(collection)
            const at = rows.findIndex((d) => d.id === Number(id))
            if (at >= 0) rows.splice(at, 1)
            db.writes.push({ op: 'delete', collection, id: Number(id) })
            return {}
        }),
        db: {
            drizzle: {
                transaction: vi.fn(async <T>(run: (tx: { execute: (query: Parameters<PgDialect['sqlToQuery']>[0]) => Promise<unknown> }) => Promise<T>) =>
                    run({
                        execute: async (query) => {
                            const built = new PgDialect().sqlToQuery(query)
                            const text = built.sql.replace(/\s+/g, ' ').trim()
                            db.sqlLog.push({ sql: text, params: built.params })
                            const lead = (id: unknown) => list('contact-submissions').find((d) => d.id === Number(id))
                            if (text.startsWith('UPDATE contact_submissions SET updated_at')) {
                                const id = Number(built.params[0])
                                const refusal = db.failUpdate?.('contact-submissions', id, {})
                                if (refusal) throw refusal
                                const doc = lead(id)
                                if (!doc) return { rows: [] }
                                doc.updatedAt = tick()
                                return { rows: [{ id }] }
                            }
                            if (text.startsWith('INSERT INTO contact_submissions_replies')) {
                                const [leadId, subject, body, sentAt, sentBy] = built.params
                                const doc = lead(leadId)!
                                doc.replies = [...((doc.replies as unknown[]) ?? []), { id: `r${db.nextId++}`, subject, body, sentAt, sentBy }]
                                return { rows: [] }
                            }
                            throw new Error(`fake cms: unexpected SQL in a transaction: ${text}`)
                        },
                    }),
                ),
                execute: vi.fn(async (query: Parameters<PgDialect['sqlToQuery']>[0]) => {
                    const built = new PgDialect().sqlToQuery(query)
                    db.sqlLog.push({ sql: built.sql.replace(/\s+/g, ' ').trim(), params: built.params })
                    return built.sql.includes('COUNT(*)::int AS total') ? { rows: [{ total: db.sqlRows.length }] } : { rows: db.sqlRows }
                }),
            },
        },
    }
    return cms
}
