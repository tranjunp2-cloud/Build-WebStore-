import { describe, it, expect, vi } from 'vitest'
import { Templates, recomputeComplianceHook } from '../../../collections/Templates'
import { checkCompliance } from '../../../lib/admin/dna-compliance'

const DNA = { signatureBlocks: ['hero', 'products'] }

function makePayload(dna: unknown) {
    return {
        find: vi.fn().mockResolvedValue({ docs: dna ? [{ id: 1, dna }] : [] }),
        update: vi.fn(),
    }
}

describe('Templates DNA compliance hook (TC-PERF-173)', () => {
    it('TC-PERF-173: runs as beforeChange and writes the cache into the saved row — no second template update', async () => {
        // Arrange: an update that changes only the description; category + layout come from the stored row
        expect(Templates.hooks?.beforeChange).toContain(recomputeComplianceHook)
        expect(Templates.hooks?.afterChange ?? []).not.toContain(recomputeComplianceHook)
        const payload = makePayload(DNA)
        const originalDoc = { id: 7, category: ['ecommerce'], templatePages: [{ layout: [{ blockType: 'hero' }] }] }
        const data: Record<string, unknown> = { description: 'new copy' }

        // Act
        const result = await recomputeComplianceHook({ data, originalDoc, req: { payload } as any, context: {}, operation: 'update' } as any)

        // Assert
        expect(payload.update).not.toHaveBeenCalled()
        expect(payload.find).toHaveBeenCalledWith(expect.objectContaining({ collection: 'categories', where: { slug: { equals: 'ecommerce' }, dna: { exists: true } } }))
        expect(payload.find.mock.calls[0][0]).toHaveProperty('req') // joins the save's transaction (TC-PERF-186)
        const expected = checkCompliance({ ...originalDoc, ...data }, DNA)
        expect(result.dnaComplianceCache).toMatchObject({ pass: expected.pass, score: expected.score, violations: expected.violations })
    })

    it('TC-PERF-173: context.skipComplianceHook or no DNA category → data unchanged', async () => {
        const skipped = makePayload(DNA)
        const a = await recomputeComplianceHook({ data: { category: ['ecommerce'] }, req: { payload: skipped } as any, context: { skipComplianceHook: true }, operation: 'update' } as any)
        expect(skipped.find).not.toHaveBeenCalled()
        expect(a).not.toHaveProperty('dnaComplianceCache')

        const noDna = makePayload(null)
        const b = await recomputeComplianceHook({ data: { category: ['ecommerce'] }, req: { payload: noDna } as any, context: {}, operation: 'create' } as any)
        expect(b).not.toHaveProperty('dnaComplianceCache')
    })
})
