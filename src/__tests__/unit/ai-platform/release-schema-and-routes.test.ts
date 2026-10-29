/**
 * TC-AIREL-81/82 — the schema the copilot server side needs, and the editor routes' draft-revision contract.
 * Schema: raw `editor_revision` columns, the Featured Products own-pictures array (collection field + the two
 * array tables, naming per .claude/rules/database-schema.md), nothing dropped.
 * Routes: editor-data returns `draftVersion` and `page.seo`; save answers `x-draft-version` and a stale `base`
 * gets 409 DRAFT_CHANGED (save-draft-revision.test.ts covers the save route in depth).
 * Real: the Pages collection config, db-setup MIGRATIONS, editor-data route. Faked: Payload, auth.
 */

import { createRequire } from 'node:module'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CollectionConfig } from 'payload'

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@/lib/auth', () => ({
    getCurrentUser: vi.fn(),
    withAuth: vi.fn((handler: (user: unknown, req: unknown, ctx: unknown) => unknown) => (req: unknown, ctx: unknown) =>
        handler({ id: 'user-1', email: 'o@x.my', tenants: [{ tenant: { id: 'tenant-1' }, role: 'owner' }] }, req, ctx)),
}))
vi.mock('@/blocks/social-widget/config', () => ({ normalizeSocialWidgetConfig: vi.fn((b: unknown) => b) }))

import { getPayload } from 'payload'
import { NextRequest } from 'next/server'
import { GET } from '@/app/api/sites/[siteId]/editor-data/route'
import { Pages } from '@/collections/Pages'

const nodeRequire = createRequire(import.meta.url)
const { MIGRATIONS } = nodeRequire('../../../../scripts/db-setup.js') as { MIGRATIONS: Array<{ name: string; sql: string }> }
const sqlOf = (name: string) => MIGRATIONS.find((m) => m.name === name)?.sql ?? ''

describe('schema for the copilot server side [TC-AIREL-81]', () => {
    it('adds the raw editor_revision columns to sites and pages, never dropping anything', () => {
        expect(sqlOf('sites.editor_revision')).toMatch(/ALTER TABLE sites ADD COLUMN IF NOT EXISTS editor_revision integer NOT NULL DEFAULT 0/)
        expect(sqlOf('pages.editor_revision')).toMatch(/ALTER TABLE pages ADD COLUMN IF NOT EXISTS editor_revision integer NOT NULL DEFAULT 0/)
        expect(MIGRATIONS.some((m) => /DROP\s+TABLE/i.test(m.sql) && /products_featured/.test(m.sql))).toBe(false)
    })

    it('creates the Featured Products picture tables the way Payload names an array: varchar id + _parent_id + _order (live), serial id (versions)', () => {
        const live = sqlOf('pages_blocks_products_featured_images.create_table')
        const versions = sqlOf('_pages_v_blocks_products_featured_images.create_table')
        expect(live).toMatch(/CREATE TABLE IF NOT EXISTS "pages_blocks_products_featured_images"/)
        expect(live).toMatch(/id varchar PRIMARY KEY/)
        expect(live).toMatch(/_parent_id varchar NOT NULL/)
        expect(live).toMatch(/_order integer/)
        expect(live).toMatch(/image_id integer, caption varchar/)
        expect(versions).toMatch(/CREATE TABLE IF NOT EXISTS "_pages_v_blocks_products_featured_images"/)
        expect(versions).toMatch(/id serial PRIMARY KEY/)
        expect(versions).toMatch(/_parent_id integer NOT NULL/)
        for (const name of ['pages_blocks_products_featured_images.indexes', '_pages_v_blocks_products_featured_images.indexes']) {
            expect(sqlOf(name)).toMatch(/_order_idx[\s\S]*_parent_id_idx[\s\S]*_image_idx/)
        }
    })

    it('registers each new migration once', () => {
        const mine = ['sites.editor_revision', 'pages.editor_revision', 'pages_blocks_products_featured_images.create_table', 'pages_blocks_products_featured_images.indexes', '_pages_v_blocks_products_featured_images.create_table', '_pages_v_blocks_products_featured_images.indexes']
        for (const name of mine) expect(MIGRATIONS.filter((m) => m.name === name)).toHaveLength(1)
    })

    it('has the matching images array (image upload to media + caption) on the products-featured block', () => {
        const layout = (Pages as CollectionConfig).fields.find((f) => 'name' in f && f.name === 'layout') as { blocks: Array<{ slug: string; fields: Array<Record<string, unknown>> }> }
        const block = layout.blocks.find((b) => b.slug === 'products-featured')!
        const images = block.fields.find((f) => f.name === 'images') as { type: string; fields: Array<Record<string, unknown>> }
        expect(images.type).toBe('array')
        expect(images.fields).toEqual([
            expect.objectContaining({ name: 'image', type: 'upload', relationTo: 'media' }),
            expect.objectContaining({ name: 'caption', type: 'text' }),
        ])
    })
})

describe('editor-data carries the draft version and the page SEO [TC-AIREL-82]', () => {
    const drizzle = {
        execute: vi.fn(async (query: unknown) => {
            const text = JSON.stringify(query)
            if (/FROM sites/.test(text)) return { rows: [{ editor_revision: 4 }] }
            if (/FROM pages/.test(text)) return { rows: [{ editor_revision: 9 }] }
            return { rows: [{ locale_content: {} }] }
        }),
    }
    const site = { id: 5, name: 'Kedai', locale: 'ms', status: 'draft', tenant: { id: 'tenant-1', slug: 'kedai' }, theme: {} }
    const homepage = { id: 21, title: 'Home', layout: [], _status: 'draft', updatedAt: '2026-10-21', seo: { title: 'Kedai Batik', description: 'Hand made' } }

    beforeEach(() => {
        vi.mocked(getPayload).mockResolvedValue({
            findByID: vi.fn(async () => site),
            find: vi.fn(async () => ({ docs: [homepage] })),
            db: { drizzle },
        } as never)
    })

    it('returns draftVersion "<site>.<page>" read before the content, and page.seo', async () => {
        const res = await GET(new NextRequest('http://localhost:3000/api/sites/5/editor-data?pageId=21'), { params: Promise.resolve({ siteId: '5' }) } as never)

        const body = (await res.json()) as { draftVersion?: string; page?: { seo: unknown } }
        expect(res.status).toBe(200)
        expect(body.draftVersion).toBe('4.9')
        expect(body.page?.seo).toEqual({ title: 'Kedai Batik', description: 'Hand made' })
    })
})
