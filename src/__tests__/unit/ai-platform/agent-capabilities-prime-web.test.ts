/**
 * TC-AISEC-054 — the copilot serves Prime Web only. The context token prime-web signs carries `caps`: Prime Web's
 * capabilities, each a real ai-platform capability, never the Product Master world of rewrite/v1 (product_master,
 * inventory, store_products), so ai-platform narrows its AI_AGENT_CAPABILITIES even when that env allows more.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { decodeJwt } from 'jose'
import { PRIME_WEB_AGENT_CAPABILITIES, signAgentContextToken, type AgentActor } from '@/lib/ai-platform/context'
import { CAPABILITIES } from '../../../../services/ai-platform/src/config/capabilities'

const SECRET = 'x'.repeat(40)
const actor = {
    user: { id: 7, email: 'owner@shop.my', firstName: 'Siti', lastName: 'Aminah' },
    tenantId: '3',
    organizationId: 'org_3',
    role: 'owner',
} as unknown as AgentActor

describe('copilot capabilities for Prime Web [TC-AISEC-054]', () => {
    const saved = process.env.AI_PLATFORM_CONTEXT_SECRET
    beforeEach(() => {
        process.env.AI_PLATFORM_CONTEXT_SECRET = SECRET
    })
    afterEach(() => {
        if (saved === undefined) delete process.env.AI_PLATFORM_CONTEXT_SECRET
        else process.env.AI_PLATFORM_CONTEXT_SECRET = saved
    })

    it('signs caps with every Prime Web capability and nothing else', async () => {
        // Act
        const claims = decodeJwt(await signAgentContextToken(actor))

        // Assert
        expect(claims.caps).toEqual([...PRIME_WEB_AGENT_CAPABILITIES])
    })

    it('names only capabilities ai-platform knows, with the shop products of Prime Web', () => {
        // Assert
        for (const capability of PRIME_WEB_AGENT_CAPABILITIES) expect(CAPABILITIES).toContain(capability)
        expect(PRIME_WEB_AGENT_CAPABILITIES).toContain('shop_products')
    })

    it('never asks for the Product Master world of rewrite/v1', () => {
        // Assert
        for (const capability of ['product_master', 'inventory', 'store_products']) {
            expect(PRIME_WEB_AGENT_CAPABILITIES as readonly string[]).not.toContain(capability)
        }
    })
})
