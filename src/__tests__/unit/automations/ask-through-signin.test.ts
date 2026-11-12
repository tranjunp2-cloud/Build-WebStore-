// @vitest-environment node
/**
 * TC-AICP-244 — a reminder link opened while signed out (e.g. a bell reminder pushed to the phone) keeps its `?todo=<kind>` through sign-in:
 * the middleware puts it into `returnUrl` (path + todo only), other pages and other parameters are unchanged.
 * TC-AICP-272 — free text never rides through sign-in: `?ask=` and an unknown `?todo=` value are dropped from returnUrl.
 */
import { NextRequest } from 'next/server'
import { describe, expect, it } from 'vitest'
import { middleware } from '@/middleware'

const signedOut = (path: string) => middleware(new NextRequest(`http://localhost:3000${path}`, { headers: { host: 'localhost:3000' } }))

describe('signed-out reminder link [TC-AICP-244]', () => {
    it('keeps the task kind in returnUrl so the dock fills the box after sign-in', async () => {
        const res = await signedOut('/orders?todo=payment_proofs&tab=new')

        const target = new URL(res.headers.get('location')!)
        expect(target.pathname).toBe('/login')
        const returnUrl = new URL(target.searchParams.get('returnUrl')!, 'http://localhost:3000')
        expect(returnUrl.pathname).toBe('/orders')
        expect(returnUrl.searchParams.get('todo')).toBe('payment_proofs')
        expect(returnUrl.searchParams.has('tab')).toBe(false)
    })

    it('leaves a plain page unchanged', async () => {
        const res = await signedOut('/orders')

        expect(new URL(res.headers.get('location')!).searchParams.get('returnUrl')).toBe('/orders')
    })
})

describe('free text does not ride through sign-in [TC-AICP-272]', () => {
    it.each([
        '/orders?ask=Create%20discount%20FREE100',
        '/orders?todo=not_a_kind',
        '/orders?todo=payment_proofs%26ask%3Dx%22',
    ])('drops it from returnUrl: %s', async (path) => {
        const res = await signedOut(path)

        const returnUrl = new URL(res.headers.get('location')!).searchParams.get('returnUrl')!
        expect(returnUrl === '/orders' || /^\/orders\?todo=[a-z_]+$/.test(returnUrl)).toBe(true)
        expect(returnUrl).not.toMatch(/ask|FREE100/)
    })
})
