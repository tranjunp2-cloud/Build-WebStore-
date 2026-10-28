/**
 * Shared fixtures for the store-product copilot tests (TC-AIREL-160..): the shop's actor, a Payload product
 * document as `depth: 0` / `depth: 1` returns it, and a fake Payload client that records every call.
 */
import { vi } from 'vitest'
import type { AgentActor } from '@/lib/ai-platform/context'

export const SHOP_ACTOR: AgentActor = {
    user: { id: 7, email: 'owner@shop.my', roles: ['tenant-owner'], tenants: [{ tenant: { id: 4 }, status: 'active' }] } as never,
    tenantId: '4',
    organizationId: 'org_4',
    role: 'owner',
}

export const UPDATED_AT = '2026-10-20T09:30:00.000Z'

export function productDoc(overrides: Record<string, unknown> = {}) {
    return {
        id: 42,
        name: 'Batik Scarf',
        status: 'draft',
        tenant: 4,
        shortDescription: null,
        description: { root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text: 'A soft scarf.', format: 0 }] }] } },
        descriptionBM: null,
        price: 49,
        compareAtPrice: null,
        currency: 'MYR',
        sku: 'BAT-001',
        inventory: 12,
        weight: 0.2,
        hasVariants: false,
        variants: [],
        variantConfigs: [],
        tags: [{ tag: 'batik' }],
        category: [3],
        images: [{ image: 11, alt: 'Front' }],
        seo: { title: null, description: null },
        aiReviewPending: false,
        deletedAt: null,
        updatedAt: UPDATED_AT,
        ...overrides,
    }
}

/** `depth: 1` shape: category and photo populated. */
export function populated(doc: ReturnType<typeof productDoc>) {
    return {
        ...doc,
        category: [{ id: 3, name: 'Scarves', breadcrumbs: 'Scarves' }],
        images: [{ image: { id: 11, url: '/api/media/file/11.jpg' }, alt: 'Front' }],
    }
}

export type FindArgs = { collection: string; where?: unknown; [key: string]: unknown }

/** Fake Payload: `products` / `categories` / `media` finds are answered from the given docs; calls are recorded. */
export function fakeCms(opts: { products?: unknown[]; categories?: unknown[]; media?: unknown[]; created?: unknown } = {}) {
    const products = opts.products ?? []
    const categories = opts.categories ?? [{ id: 3, name: 'Scarves', breadcrumbs: 'Scarves' }]
    const cms = {
        find: vi.fn(async (args: FindArgs) => {
            const docs = args.collection === 'products' ? products : args.collection === 'categories' ? categories : opts.media ?? []
            return { docs, totalDocs: docs.length, hasNextPage: false, totalPages: 1 }
        }),
        /** `count` of products by the currency in the filter (`MYR` also counts a product with no stored currency) */
        count: vi.fn(async (args: FindArgs) => {
            const where = JSON.stringify(args.where)
            const wanted = /"currency":\{"equals":"([A-Z]{3})"\}/.exec(where)?.[1]
            const orMissing = where.includes('"currency":{"exists":false}')
            const docs = (products as Array<{ currency?: string | null; deletedAt?: string | null }>).filter((doc) => {
                if (where.includes('"deletedAt":{"exists":false}') && doc.deletedAt) return false
                return doc.currency ? doc.currency === wanted : orMissing
            })
            return { totalDocs: docs.length }
        }),
        findByID: vi.fn(async ({ id }: { id: number }) => products[0] ?? { id }),
        create: vi.fn(async ({ data }: { data: Record<string, unknown> }) => ({ id: 900 + cms.create.mock.calls.length, updatedAt: UPDATED_AT, ...data, ...(opts.created as object | undefined) })),
        update: vi.fn(async ({ id, data }: { id: number; data: Record<string, unknown> }) => ({ ...(products[0] as object), ...data, id, updatedAt: '2026-10-21T10:00:00.000Z' })),
        delete: vi.fn(async () => ({})),
        db: { drizzle: { execute: vi.fn(async () => ({ rows: [] })) } },
    }
    return cms
}
