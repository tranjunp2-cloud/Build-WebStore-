/**
 * #2103 A1 — grounded generation can leave a list block with nothing true to say.
 * Payload rejects a page whose block has an empty `required` array field, which failed the
 * whole generation ("Page Blocks > Block 9 (Stats Section) > Stats"). Such blocks are dropped.
 */
import { describe, expect, it, vi } from 'vitest'
import type { Block, Field } from 'payload'

vi.mock('@payload-config', () => ({ default: {} }))
vi.mock('payload', () => ({ getPayload: vi.fn() }))

import { Pages } from '@/collections/Pages'
import { isEmptyRequiredListBlock } from '@/lib/ai/grounded-blocks'
import { sanitizeBlocksForPayload } from '@/lib/ai/pages-schema'

const GENERATED_LIST_BLOCKS = ['stats', 'features', 'pricing', 'pricing-table', 'testimonials', 'team', 'faq', 'logo-cloud']

function pageBlocks(): Block[] {
    const layout = Pages.fields.find((f): f is Field & { name: string; blocks: Block[] } =>
        'name' in f && f.name === 'layout' && 'blocks' in f)
    return layout?.blocks ?? []
}

function requiredArrayFields(block: Block): string[] {
    return block.fields
        .filter((f): f is Field & { name: string } => f.type === 'array' && 'required' in f && f.required === true && 'name' in f)
        .map((f) => f.name)
}

describe('grounded blocks with empty required lists (#2103 A1)', () => {
    it('[TC-AIAUD-170] every generated list block with a required array is dropped when the array is empty', () => {
        // Arrange
        const blocks = pageBlocks().filter((b) => GENERATED_LIST_BLOCKS.includes(b.slug))
        expect(blocks.length).toBe(GENERATED_LIST_BLOCKS.length)

        for (const block of blocks) {
            for (const field of requiredArrayFields(block)) {
                // Act
                const empty = isEmptyRequiredListBlock({ blockType: block.slug, [field]: [] })
                const missing = isEmptyRequiredListBlock({ blockType: block.slug })
                const filled = isEmptyRequiredListBlock({ blockType: block.slug, [field]: [{ value: '1' }] })

                // Assert
                expect(empty, `${block.slug}.${field} empty`).toBe(true)
                expect(missing, `${block.slug}.${field} missing`).toBe(true)
                expect(filled, `${block.slug}.${field} filled`).toBe(false)
            }
        }
    })

    it('[TC-AIAUD-171] blocks whose lists are optional are kept empty (renderers show nothing)', () => {
        // Arrange — pricing without plans is dropped on purpose (no tiers may be invented, TC-AIAUD-145)
        const droppedByDesign = ['pricing', 'pricing-table']
        const optional = pageBlocks()
            .filter((b) => GENERATED_LIST_BLOCKS.includes(b.slug) && requiredArrayFields(b).length === 0)
            .map((b) => b.slug)
            .filter((slug) => !droppedByDesign.includes(slug))
        expect(optional.length).toBeGreaterThan(0)

        // Act + Assert
        for (const slug of optional) {
            expect(isEmptyRequiredListBlock({ blockType: slug }), slug).toBe(false)
        }
        expect(isEmptyRequiredListBlock({ blockType: 'hero' })).toBe(false)
        expect(isEmptyRequiredListBlock(null)).toBe(false)
    })

    it('[TC-AIAUD-202] the shared sanitizeBlocksForPayload (recovery, apply-template) drops empty required lists, keeps filled ones', () => {
        // Arrange
        const blocks = [
            { blockType: 'hero', headline: 'Hi' },
            { blockType: 'stats', stats: [] },
            { blockType: 'features' },
            { blockType: 'stats', stats: [{ value: '2019', label: 'Since' }, { value: '3', label: 'Products' }] },
        ]

        // Act
        const out = sanitizeBlocksForPayload(blocks)

        // Assert
        expect(out.map((b) => b.blockType)).toEqual(['hero', 'stats'])
        expect((out[1]!.stats as unknown[]).length).toBe(2)
    })
})
