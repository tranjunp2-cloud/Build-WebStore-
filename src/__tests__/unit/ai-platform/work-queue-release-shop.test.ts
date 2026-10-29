/**
 * TC-WQ-151..153 — the release's shop issues: every To do row becomes an issue that says why it matters in a coloured
 * fact (red for "now", amber for "soon"), without repeating the To do sentence the fact already says; the website's
 * SEO health becomes one issue (count, the first issue names, the search score, "Fix with AI" for the assistant).
 * Real: shop-work-sources.ts, seo-work-item.ts, work-format.ts. Faked: the SEO evaluation (Payload reads), the site lookup.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ evaluate: vi.fn(), firstUsableSite: vi.fn() }))
vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))
vi.mock('@/lib/seo/local-seo-evaluation', () => ({ evaluateAuthoritativeLocalSeo: mocks.evaluate }))
vi.mock('@/lib/insights/shop-todo', () => ({ firstUsableSite: mocks.firstUsableSite, computeShopTodos: vi.fn() }))

import type { ShopTodoItem } from '@/lib/insights/shop-todo'
import { shopTodoWorkItem } from '@/lib/ai-platform/work/shop-work-sources'
import { seoWorkItem } from '@/lib/ai-platform/work/seo-work-item'

const todo = (kind: ShopTodoItem['kind'], over: Partial<ShopTodoItem> = {}): ShopTodoItem => ({
    id: kind, kind, severity: 'medium', title: `Title ${kind}`, detail: `Detail ${kind}.`, count: 2, href: '/x', prompt: `Help with ${kind}`, ...over,
})

beforeEach(() => {
    vi.clearAllMocks()
    mocks.firstUsableSite.mockResolvedValue('7')
})

describe('shop issues say why they matter [TC-WQ-151]', () => {
    it('gives "now" rows a red fact and "soon" rows an amber one, dropping a To do sentence the fact already says', () => {
        const out = shopTodoWorkItem(todo('out_of_stock', { severity: 'high' }), 'en', 0)
        const drafts = shopTodoWorkItem(todo('products_ai_review'), 'en', 10)
        const site = shopTodoWorkItem(todo('site_unpublished', { neverPublished: true }), 'ms', 20)

        expect(out).toMatchObject({ group: 'now', fact: { text: "buyers can't order", tone: 'late' }, detail: 'Detail out_of_stock.' })
        expect(drafts).toMatchObject({ group: 'week', fact: { text: 'not on sale yet', tone: 'near' } })
        expect(drafts!.detail).toBeUndefined()
        expect(site).toMatchObject({ fact: { text: 'pelawat tidak nampak kedai anda' }, area: 'Laman web' })
    })

    it('puts the age of the oldest order into the fact [TC-WQ-152]', () => {
        expect(shopTodoWorkItem(todo('orders_to_confirm', { severity: 'high', ageHours: 3 }), 'en', 0)!.fact).toEqual({ text: 'oldest waiting 3 h', tone: 'late' })
    })
})

describe('the work item starts "finish your store" [TC-AIAUD-121]', () => {
    it('words the AI-draft and out-of-stock issues as finishing the shop and updating stock, in both languages', () => {
        const drafts = shopTodoWorkItem(todo('products_ai_review'), 'en', 10)
        const draftsMs = shopTodoWorkItem(todo('products_ai_review'), 'ms', 10)
        const stock = shopTodoWorkItem(todo('out_of_stock', { severity: 'high' }), 'en', 0)

        expect(drafts!.actions[0]).toMatchObject({ kind: 'prompt', label: 'Finish your shop' })
        expect(drafts!.say).toContain('Finish setting them up?')
        expect(draftsMs!.actions[0]).toMatchObject({ label: 'Siapkan kedai anda' })
        expect(stock!.actions[0]).toMatchObject({ kind: 'prompt', label: 'Update stock' })
        // the prompt behind the button is the To do's own, which the wording step now writes as the finish flow
        expect(drafts!.actions[0]).toMatchObject({ value: 'Help with products_ai_review' })
    })
})

describe('SEO health as one issue [TC-WQ-153]', () => {
    const issue = (code: string) => ({ id: code, code, count: 1, action: { kind: 'edit-phone', siteId: '7' } })

    it('counts the issues, names the first three, colours the score red below 50 and hands the fix to the assistant', async () => {
        mocks.evaluate.mockResolvedValue({ response: { score: 49, issues: ['business-address', 'phone', 'opening-hours', 'map-location'].map(issue) } })

        const item = await seoWorkItem({} as never, '4', null, 'en')

        expect(mocks.evaluate).toHaveBeenCalledWith({}, '7', '4')
        expect(item).toMatchObject({
            key: 'shop:seo_issues',
            group: 'week',
            title: '4 SEO issues on your website',
            detail: 'Business address, phone number, opening hours +1',
            fact: { text: 'search score 49 / 100', tone: 'late' },
            icon: 'search',
            actions: [{ kind: 'prompt', label: 'Fix with AI' }, { kind: 'link', value: '/editor/7?settingsTab=global' }],
        })
    })

    it('is no issue when the website has none (or no website)', async () => {
        mocks.evaluate.mockResolvedValue({ response: { score: 92, issues: [] } })
        expect(await seoWorkItem({} as never, '4', '7', 'en')).toBeNull()
        mocks.firstUsableSite.mockResolvedValue(null)
        expect(await seoWorkItem({} as never, '4', null, 'en')).toBeNull()
    })
})
