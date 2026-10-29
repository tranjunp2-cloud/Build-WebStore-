/**
 * TC-AIAUD-132..137 — the copilot's selling-setup list (`readShopSetup`): cash on delivery as the only payment,
 * missing phone / address / opening hours, no custom domain, live products with no stock or price, live products
 * showing stock or AI pictures. Scoped to the workspace, hidden for areas the viewer cannot open, one failed read
 * never takes the rest down, and none of it leaks into the To do list (kinds, wording, link prompts).
 * Real: lib/insights/shop-setup, shop-todo-text. Faked: Payload's local API and the first-site lookup.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ firstUsableSite: vi.fn() }))
vi.mock('@/lib/insights/shop-todo', () => ({ firstUsableSite: mocks.firstUsableSite }))

import { readShopSetup } from '@/lib/insights/shop-setup'
import { FINISH_STORE_PROMPT, isShopTodoKind, SHOP_SETUP_KINDS, SHOP_TODO_KINDS, todoLinkPrompt } from '@/lib/insights/shop-todo-text'

type Doc = Record<string, unknown>
const media = (flags: Doc = {}) => ({ image: { id: 1, ...flags }, alt: 'x' })
const ready = {
    tenant: { payments: { payment_cod: true, payment_qr: true }, customDomains: [{ domain: 'shop.my', status: 'active' }], whatsappNumber: '60123456789', businessAddress: '1 Jalan Satu' } as Doc,
    site: { contactInfo: { phone: '03-1234', address: '1 Jalan Satu' }, localBusiness: { openingHours: [{ dayOfWeek: 'monday', opens: '09:00', closes: '18:00' }] } } as Doc,
    products: [{ inventory: 5, price: 20, hasVariants: false, images: [media()] }] as Doc[],
}

function fakePayload(data: { tenant?: Doc; site?: Doc | null; products?: Doc[] } = {}, fail: Partial<Record<'tenant' | 'site' | 'products', boolean>> = {}) {
    const merged = { ...ready, ...data }
    return {
        findByID: vi.fn(async () => {
            if (fail.tenant) throw new Error('tenants down')
            return merged.tenant
        }),
        find: vi.fn(async (args: { collection: string }) => {
            if (args.collection === 'sites') {
                if (fail.site) throw new Error('sites down')
                return { docs: merged.site ? [merged.site] : [] }
            }
            if (fail.products) throw new Error('products down')
            return { docs: merged.products }
        }),
    }
}
const read = (payload: ReturnType<typeof fakePayload>, over: Record<string, unknown> = {}) => readShopSetup(payload as never, { tenantId: 4, ...over })
const kinds = (items: Array<{ kind: string }>) => items.map((item) => item.kind)

beforeEach(() => {
    vi.clearAllMocks()
    mocks.firstUsableSite.mockResolvedValue('9')
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

describe('a shop that is ready [TC-AIAUD-132]', () => {
    it('lists nothing', async () => {
        expect(await read(fakePayload())).toEqual([])
    })
})

describe('payments, business details, domain [TC-AIAUD-133..134]', () => {
    it('flags cash on delivery as the only way to pay, and says whether online payments can be connected [TC-AIAUD-133]', async () => {
        const items = await read(fakePayload({ tenant: { ...ready.tenant, payments: { payment_cod: true, payment_card: false, payment_fpx: false, payment_qr: false, xendit_tng: false } } }))

        expect(items).toEqual([expect.objectContaining({ kind: 'payments_cod_only', severity: 'medium', count: 1, href: '/settings/payments', title: 'Buyers can only pay cash on delivery' })])
        expect(items[0]?.detail).toContain('not connected yet')
        const connected = await read(fakePayload({ tenant: { ...ready.tenant, stripeOnboardingComplete: true, payments: { payment_cod: true } } }))
        expect(connected[0]?.detail).toBe('Card, FPX, e-wallets and bank transfer are switched off.')
    })

    it.each(['payment_card', 'payment_fpx', 'payment_qr', 'xendit_tng', 'xendit_mae'])('is no gap once %s is on', async (method) => {
        expect(await read(fakePayload({ tenant: { ...ready.tenant, payments: { payment_cod: true, [method]: true } } }))).toEqual([])
    })

    it('is urgent when no payment method is on at all', async () => {
        const items = await read(fakePayload({ tenant: { ...ready.tenant, payments: { payment_cod: false } } }))
        expect(items[0]).toMatchObject({ kind: 'payments_cod_only', severity: 'high', title: 'No way to pay is switched on' })
    })

    it('names the business details that are missing, counting a WhatsApp number or a tenant address as given [TC-AIAUD-134]', async () => {
        const none = await read(fakePayload({ tenant: { ...ready.tenant, whatsappNumber: '', businessAddress: '' }, site: { contactInfo: {}, localBusiness: { openingHours: [] } } }))
        expect(none).toEqual([expect.objectContaining({ kind: 'business_info_missing', count: 3, href: '/editor/9?settingsTab=global', title: 'Business details missing: phone number, address, opening hours' })])

        const viaTenant = await read(fakePayload({ site: { contactInfo: {}, localBusiness: { openingHours: [{ isClosed: true }] } } }))
        expect(viaTenant).toEqual([])
        const hoursOnly = await read(fakePayload({ site: { contactInfo: { phone: '1', address: 'a' }, localBusiness: { openingHours: [{ opens: '09:00', closes: '' }] } } }))
        expect(hoursOnly[0]).toMatchObject({ count: 1, title: 'Business details missing: opening hours' })
    })

    it('asks no opening hours of a shop without a website, and points to the profile page then', async () => {
        mocks.firstUsableSite.mockResolvedValue(null)
        const items = await read(fakePayload({ tenant: { ...ready.tenant, whatsappNumber: '', businessAddress: '' }, site: null }))
        expect(items[0]).toMatchObject({ kind: 'business_info_missing', count: 2, href: '/settings/profile', title: 'Business details missing: phone number, address' })
    })

    it('flags a shop with no active custom domain (a pending one does not count)', async () => {
        const items = await read(fakePayload({ tenant: { ...ready.tenant, customDomains: [{ domain: 'shop.my', status: 'pending' }] } }))
        expect(items).toEqual([expect.objectContaining({ kind: 'custom_domain_missing', severity: 'low', href: '/settings/domains' })])
    })

    it('reads the site of this shop only', async () => {
        const payload = fakePayload()
        await read(payload)
        const siteQuery = payload.find.mock.calls.map(([args]) => args as { collection: string; where?: unknown }).find((args) => args.collection === 'sites')
        expect(JSON.stringify(siteQuery?.where)).toBe('{"and":[{"id":{"equals":9}},{"tenant":{"equals":4}}]}')
        expect(payload.findByID).toHaveBeenCalledWith(expect.objectContaining({ collection: 'tenants', id: 4 }))
    })
})

describe('products [TC-AIAUD-135]', () => {
    const product = (over: Doc = {}) => ({ inventory: 5, price: 20, hasVariants: false, images: [media()], ...over })

    it('counts live products with no stock or no price, with the breakdown, leaving products with options alone', async () => {
        const items = await read(
            fakePayload({
                products: [
                    product({ inventory: 0 }),
                    product({ inventory: 0, price: 0 }),
                    product({ price: 0 }),
                    product(),
                    // options keep their price and stock per option, set in the form: not countable here
                    product({ inventory: 0, price: 0, hasVariants: true }),
                ],
            }),
        )

        expect(items).toEqual([
            expect.objectContaining({
                kind: 'products_setup',
                severity: 'high',
                count: 3,
                title: '3 live products have no stock or no price',
                detail: '2 with 0 in stock, 2 with a price of 0. Buyers cannot order them.',
                prompt: FINISH_STORE_PROMPT.en,
            }),
        ])
    })

    it('counts products whose pictures are all stock or AI, not mixed galleries, uploads or products without pictures', async () => {
        const items = await read(
            fakePayload({
                products: [
                    product({ images: [media({ sourceProvider: 'pixabay' })] }),
                    product({ images: [media({ aiGenerated: true }), media({ sourceProvider: 'wikimedia' })] }),
                    product({ images: [media({ sourceProvider: 'ai' })] }),
                    product({ images: [media({ sourceProvider: 'pixabay' }), media()] }),
                    product({ images: [media()] }),
                    product({ images: [] }),
                ],
            }),
        )

        expect(items).toEqual([expect.objectContaining({ kind: 'products_stock_photos', severity: 'medium', count: 3, title: '3 live products show stock or AI pictures' })])
    })

    it('reads only active products of this shop, with the media flags it needs', async () => {
        const payload = fakePayload()
        await read(payload)
        const query = payload.find.mock.calls.map(([args]) => args as Record<string, unknown>).find((args) => args.collection === 'products')
        expect(JSON.stringify(query?.where)).toBe('{"and":[{"tenant":{"equals":4}},{"status":{"equals":"active"}},{"deletedAt":{"exists":false}}]}')
        expect(query).toMatchObject({ depth: 1, populate: { media: { aiGenerated: true, sourceProvider: true } } })
    })

    it('puts the most urgent first, and words it in Malay for a Malay merchant', async () => {
        const items = await read(
            fakePayload({ tenant: { payments: { payment_cod: true }, customDomains: [] }, products: [product({ inventory: 0 }), product({ images: [media({ sourceProvider: 'pixabay' })] })] }),
            { locale: 'ms' },
        )

        expect(kinds(items)).toEqual(['products_setup', 'products_stock_photos', 'payments_cod_only', 'custom_domain_missing'])
        expect(kinds(items)).toEqual(SHOP_SETUP_KINDS.filter((kind) => kinds(items).includes(kind)))
        expect(items[0]?.title).toBe('1 produk aktif tiada stok atau harga')
        expect(items[2]?.title).toBe('Pembeli hanya boleh bayar tunai semasa penghantaran')
    })
})

describe('who sees what, and failures [TC-AIAUD-136]', () => {
    it('hides settings for a member without them and products for a member without them, and does not even read them', async () => {
        const noSettings = fakePayload({ tenant: { payments: {}, customDomains: [] }, products: [{ inventory: 0, price: 0, images: [] }] })
        const items = await read(noSettings, { areas: { settings: false } })
        expect(kinds(items)).toEqual(['products_setup'])
        expect(noSettings.findByID).not.toHaveBeenCalled()

        const noProducts = fakePayload({ tenant: { payments: {}, customDomains: [] }, products: [{ inventory: 0, price: 0, images: [] }] })
        const other = await read(noProducts, { areas: { products: false } })
        expect(kinds(other)).toEqual(['payments_cod_only', 'business_info_missing', 'custom_domain_missing'].filter((kind) => kinds(other).includes(kind)))
        expect(kinds(other)).not.toContain('products_setup')
        expect(noProducts.find.mock.calls.some(([args]) => (args as { collection: string }).collection === 'products')).toBe(false)
    })

    it('leaves out the part whose read failed and keeps the rest', async () => {
        const items = await read(fakePayload({ products: [{ inventory: 0, price: 0, images: [] }] }, { tenant: true }))
        expect(kinds(items)).toEqual(['products_setup'])

        const noProducts = await read(fakePayload({ tenant: { payments: {}, customDomains: [] } }, { products: true }))
        expect(kinds(noProducts)).toEqual(['payments_cod_only', 'custom_domain_missing'])
    })

    it('refuses a missing workspace id instead of reading nothing', async () => {
        await expect(readShopSetup(fakePayload() as never, { tenantId: 'abc' })).rejects.toThrow(/valid tenant id/)
    })
})

describe('the To do list stays as it was [TC-AIAUD-137]', () => {
    it('keeps the setup kinds out of the To do kinds, so no card, badge, link or automation can carry them', () => {
        for (const kind of SHOP_SETUP_KINDS) {
            expect(SHOP_TODO_KINDS as readonly string[]).not.toContain(kind)
            expect(isShopTodoKind(kind)).toBe(false)
        }
    })

    it('starts the finish-your-store flow from ?todo=products_ai_review and ?todo=out_of_stock', () => {
        expect(todoLinkPrompt('products_ai_review', 'en')).toBe(FINISH_STORE_PROMPT.en)
        expect(FINISH_STORE_PROMPT.en).toMatch(/no stock or no price, or only have stock photos/)
        expect(todoLinkPrompt('products_ai_review', 'ms')).toBe(FINISH_STORE_PROMPT.ms)
        expect(todoLinkPrompt('out_of_stock', 'en')).toMatch(/how many I have of each \(one list\)/)
        expect(todoLinkPrompt('out_of_stock', 'ms')).toMatch(/satu senarai/)
        // a link needs no matching task: the kind alone is enough
        expect(isShopTodoKind('products_ai_review')).toBe(true)
    })
})
