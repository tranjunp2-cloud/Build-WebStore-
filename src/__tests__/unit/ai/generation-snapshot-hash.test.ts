import { describe, expect, it } from 'vitest'
import { canonicalJson, hashGenerationSnapshot } from '@/lib/ai/generation-snapshot-hash'

describe('generation snapshot hashing', () => {
    it('TC-F41-09: hashes semantically identical objects identically regardless of JSONB key order', () => {
        const requestShape = { businessInfo: { businessName: 'Demo', industry: 'tech' }, language: 'en', contentBrief: { referenceContent: { title: 'Hello' }, visualStyle: {} } }
        const reloadedJsonbShape = { contentBrief: { visualStyle: {}, referenceContent: { title: 'Hello' } }, language: 'en', businessInfo: { industry: 'tech', businessName: 'Demo' } }

        expect(canonicalJson(requestShape)).toBe(canonicalJson(reloadedJsonbShape))
        expect(hashGenerationSnapshot(requestShape)).toBe(hashGenerationSnapshot(reloadedJsonbShape))
    })

    it('TC-F41-09: uses bytewise UTF-8 key order for nested Unicode JSONB snapshots', () => {
        // Vietnamese and astral keys exercise the runtime/DB ordering contract;
        // their insertion order must never affect recovery eligibility.
        const requestShape = { contentBrief: { '🚀': { 'đề-mục': 'A' }, 'á': 1, a: 2 }, businessInfo: { businessName: 'Demo' } }
        const reloadedJsonbShape = { businessInfo: { businessName: 'Demo' }, contentBrief: { a: 2, 'á': 1, '🚀': { 'đề-mục': 'A' } } }

        expect(canonicalJson(requestShape)).toBe(canonicalJson(reloadedJsonbShape))
        expect(hashGenerationSnapshot(requestShape)).toBe(hashGenerationSnapshot(reloadedJsonbShape))
    })

    it('TC-F41-09: serializes exponent-form numbers as JSONB decimal scalars', () => {
        // JSON.stringify emits exponent notation here, whereas jsonb::text
        // uses decimal notation after a snapshot is persisted and reloaded.
        expect(canonicalJson({ tiny: 1e-7, huge: 1e21 })).toBe('{"huge":1000000000000000000000,"tiny":0.0000001}')
    })
})
