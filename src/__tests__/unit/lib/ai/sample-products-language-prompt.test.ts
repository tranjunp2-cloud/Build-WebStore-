// @vitest-environment node
/**
 * #2160 — sample product copy follows the site language.
 * TC-TF-028a..c (docs/qa/F01-template-first-gen.md)
 *
 * The storefront shows `shortDescription` on every product surface, so a Malay
 * site must get it in Bahasa Melayu. Only the AI platform transport is mocked;
 * the prompt is built by the real prepareSampleProducts.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockRunTask } = vi.hoisted(() => ({ mockRunTask: vi.fn() }))

vi.mock('@/lib/ai-platform/task-client', () => ({ getAiTaskClient: () => ({ runTask: mockRunTask }) }))

import { prepareSampleProducts as prepareSampleProductsInScope } from '@/lib/ai/generate-sample-products'
import { runWithAiActor } from '@/lib/ai-platform/actor-scope'

const ACTOR = { user: { id: 7 }, tenantId: '1', organizationId: 'org_1', role: 'owner' } as never
const prepareSampleProducts: typeof prepareSampleProductsInScope = (...args) =>
    runWithAiActor(ACTOR, () => prepareSampleProductsInScope(...args))

// Issue #2160 repro input (UAT production 30/10/2026).
const businessInfo = {
    businessName: 'Kopi Ipoh UAT',
    industry: 'fnb',
    products: 'Kek lapis, roti canai, kopi tarik',
    shortDescription: 'Kedai kopi keluarga di Ipoh yang menyajikan kek lapis dan kopi tarik setiap hari.',
}

const MALAY_RULE = 'Write "shortDescription" in Bahasa Melayu (Malaysia).'

/** The user prompt sent to the `sitegen.sample-products` task. */
function sentPrompt(): string {
    const [taskId, input] = mockRunTask.mock.calls[0]!
    expect(taskId).toBe('sitegen.sample-products')
    return (input as { user: string }).user
}

beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubEnv('AI_PLATFORM_URL', 'http://ai.internal:8300')
    vi.stubEnv('AI_PLATFORM_CONTEXT_SECRET', 'test-context-secret-at-least-32-characters')
    mockRunTask.mockResolvedValue({
        output: {
            products: [
                { name: 'Kek lapis', shortDescription: 'Kek berlapis lembut', description: 'Layered cake.', descriptionBM: 'Kek berlapis.', price: 25, imageKeyword: 'layer cake' },
                { name: 'roti canai', shortDescription: 'Roti rangup', description: 'Flatbread.', descriptionBM: 'Roti leper.', price: 3, imageKeyword: 'flatbread' },
                { name: 'kopi tarik', shortDescription: 'Kopi susu ditarik', description: 'Pulled milk coffee.', descriptionBM: 'Kopi susu.', price: 4, imageKeyword: 'milk coffee' },
            ],
        },
        usage: { model: 'test', inputTokens: 10, outputTokens: 5 },
    })
})

afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
})

describe('[TC-TF-028] sample product prompt language (#2160)', () => {
    it('[TC-TF-028a] ms → shortDescription must be Bahasa Melayu; description EN + descriptionBM kept', async () => {
        // Act
        const result = await prepareSampleProducts(businessInfo, 'ms')

        // Assert
        const prompt = sentPrompt()
        expect(prompt).toContain(MALAY_RULE)
        expect(prompt).toContain('"shortDescription":"max 100 chars, Bahasa Melayu"')
        expect(prompt).toContain('"descriptionBM":"Bahasa Melayu translation"')
        expect(result.products.map((p) => p.shortDescription)).toEqual(['Kek berlapis lembut', 'Roti rangup', 'Kopi susu ditarik'])
        expect(result.products[0]).toMatchObject({ name: 'Kek lapis', description: 'Layered cake.', descriptionBM: 'Kek berlapis.' })
    })

    it('[TC-TF-028b] en → no Bahasa Melayu rule, no descriptionBM field (regression)', async () => {
        // Act
        await prepareSampleProducts(businessInfo, 'en')

        // Assert
        const prompt = sentPrompt()
        expect(prompt).not.toContain('Bahasa Melayu')
        expect(prompt).toContain('"shortDescription":"max 100 chars"')
    })

    it('[TC-TF-028c] vi → keeps the generic target-language rule, no Malay rule (regression)', async () => {
        // Act
        await prepareSampleProducts(businessInfo, 'vi')

        // Assert
        const prompt = sentPrompt()
        expect(prompt).toMatch(/Write product names and customer-facing descriptions in Vi/)
        expect(prompt).not.toContain(MALAY_RULE)
        expect(prompt).not.toContain('descriptionBM')
    })
})
