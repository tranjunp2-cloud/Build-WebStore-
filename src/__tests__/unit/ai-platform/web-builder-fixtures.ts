/**
 * Shared fixtures for the web builder copilot tests (TC-AIWB-*): a site in workspace 1, its home page
 * draft, and the actor that owns it. Blocks validate against the real block registry.
 */
import type { AgentActor } from '@/lib/ai-platform/context'

export const SITE_ID = 5
export const PAGE_ID = 10

export const NAV = { blockType: 'navigation', id: '00000000-0000-4000-8000-0000000000a1', variant: 'default', logoText: 'Kedai Batik' }
export const HERO = {
    blockType: 'hero',
    id: '00000000-0000-4000-8000-0000000000b1',
    variant: 'centered',
    headline: 'Batik for every day',
    subheadline: 'Hand-made in Kelantan',
    ctaButtons: [{ label: 'Shop', url: '/shop', style: 'primary' }],
}
export const FAQ = { blockType: 'faq', id: '00000000-0000-4000-8000-0000000000c1', variant: 'accordion', headline: 'Questions', items: [{ question: 'Ship to Sabah?', answer: 'Yes' }] }
export const PRODUCTS = { blockType: 'products-grid', id: '00000000-0000-4000-8000-0000000000d1', variant: 'grid-3', headline: 'Shop', selectedProductIds: ['1'] }
export const FOOTER = { blockType: 'footer', id: '00000000-0000-4000-8000-0000000000e1', variant: 'simple', copyrightText: '© Kedai Batik' }

export const LAYOUT = [NAV, HERO, FAQ, PRODUCTS, FOOTER]

export function site(overrides: Record<string, unknown> = {}) {
    return { id: SITE_ID, name: 'Kedai Batik', tenant: { id: 1 }, theme: { primaryColor: '#0ea5e9', colorMode: 'light' }, ...overrides }
}

export function page(layout: unknown[] = LAYOUT, overrides: Record<string, unknown> = {}) {
    return { id: PAGE_ID, site: SITE_ID, title: 'Home', slug: '/', isHomepage: true, _status: 'draft', layout, ...overrides }
}

/** The workspace 1 owner, as the copilot's actor (tenantId is the site's tenant). */
export const OWNER: AgentActor = {
    user: { id: 7, email: 'owner@shop.my', roles: ['tenant-owner'], tenants: [{ tenant: { id: 1 }, status: 'active', role: 'owner' }] } as never,
    tenantId: '1',
    organizationId: 'org_1',
    role: 'owner',
}

/** The in-memory Payload stand-in the site modules read through (Local API, merchant access). */
export type FakeDb = { site: Record<string, unknown> | null; page: Record<string, unknown> | null; products: Array<{ id: string }> }

/**
 * A value as the AI platform hands it back after its jsonb column: Postgres keeps object keys by length, then by
 * bytes (`{op, block, afterBlockId}`), whatever order they were written in. Same data, different key order.
 */
export function jsonbOrder<T>(value: T): T {
    if (Array.isArray(value)) return value.map(jsonbOrder) as T
    if (value && typeof value === 'object') {
        const keys = Object.keys(value).sort((a, b) => a.length - b.length || (a < b ? -1 : a > b ? 1 : 0))
        return Object.fromEntries(keys.map((key) => [key, jsonbOrder((value as Record<string, unknown>)[key])])) as T
    }
    return value
}
