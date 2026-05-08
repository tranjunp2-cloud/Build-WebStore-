import { describe, it, expect } from 'vitest'
import { mapVariantData } from '@/blocks/pricing/variant-data-mapping'
import type { PricingConfig, PricingFeatureMatrixRow, PricingPlan } from '@/blocks/pricing/config'

// ── TC-F05-891: Pricing Block Item Management — Variant Data Mapping ───────

describe('[TC-F05-891] mapVariantData — Variant Transitions & Feature Derivation', () => {
    // ─────────────────────────────────────────────────────────────────────
    describe('Branch 1: Standard → Matrix (cards/horizontal/toggle → table/comparison)', () => {
        it('TC-F05-891.121: cards → table builds featureMatrix from plan.features when empty', () => {
            // Arrange
            const block: PricingConfig = {
                blockType: 'pricing',
                variant: 'cards',
                plans: [
                    {
                        name: 'Basic',
                        price: '$29',
                        ctaLabel: 'Get Started',
                        ctaUrl: '/signup',
                        features: [
                            { text: 'Feature A', included: true },
                            { text: 'Feature B', included: true },
                        ],
                    },
                    {
                        name: 'Pro',
                        price: '$99',
                        ctaLabel: 'Upgrade',
                        ctaUrl: '/upgrade',
                        features: [
                            { text: 'Feature A', included: true },
                            { text: 'Feature C', included: true },
                        ],
                    },
                ],
                featureMatrix: [],
            }

            // Act
            const result = mapVariantData(block, 'table')

            // Assert
            expect(result.featureMatrix).toBeDefined()
            expect(result.featureMatrix).toHaveLength(3)
            expect(result.featureMatrix?.[0]).toEqual({
                featureName: 'Feature A',
                values: [{ included: true }, { included: true }],
            })
            expect(result.featureMatrix?.[1]).toEqual({
                featureName: 'Feature B',
                values: [{ included: true }, { included: false }],
            })
            expect(result.featureMatrix?.[2]).toEqual({
                featureName: 'Feature C',
                values: [{ included: false }, { included: true }],
            })
        })

        it('TC-F05-891.122: horizontal → comparison builds featureMatrix from plan.features', () => {
            // Arrange
            const block: PricingConfig = {
                blockType: 'pricing',
                variant: 'horizontal',
                plans: [
                    {
                        name: 'Starter',
                        price: '$19',
                        ctaLabel: 'Start',
                        ctaUrl: '/start',
                        features: [{ text: 'Basic Support', included: true }],
                    },
                    {
                        name: 'Professional',
                        price: '$49',
                        ctaLabel: 'Choose',
                        ctaUrl: '/choose',
                        features: [
                            { text: 'Basic Support', included: true },
                            { text: 'Priority Support', included: true },
                        ],
                    },
                ],
            }

            // Act
            const result = mapVariantData(block, 'comparison')

            // Assert
            expect(result.featureMatrix).toHaveLength(2)
            expect(result.featureMatrix?.[0].featureName).toBe('Basic Support')
            expect(result.featureMatrix?.[1].featureName).toBe('Priority Support')
        })

        it('TC-F05-891.123: de-duplicates features across multiple plans (insertion order)', () => {
            // Arrange — 3 plans with overlapping features
            const block: PricingConfig = {
                blockType: 'pricing',
                variant: 'cards',
                plans: [
                    {
                        name: 'Plan A',
                        price: '$10',
                        ctaLabel: 'Buy',
                        ctaUrl: '/buy',
                        features: [
                            { text: 'Feature 1', included: true },
                            { text: 'Feature 2', included: true },
                            { text: 'Feature 3', included: true },
                        ],
                    },
                    {
                        name: 'Plan B',
                        price: '$20',
                        ctaLabel: 'Buy',
                        ctaUrl: '/buy',
                        features: [
                            { text: 'Feature 1', included: true },
                            { text: 'Feature 3', included: true },
                            { text: 'Feature 4', included: true },
                        ],
                    },
                    {
                        name: 'Plan C',
                        price: '$30',
                        ctaLabel: 'Buy',
                        ctaUrl: '/buy',
                        features: [
                            { text: 'Feature 2', included: true },
                            { text: 'Feature 4', included: true },
                            { text: 'Feature 5', included: true },
                        ],
                    },
                ],
            }

            // Act
            const result = mapVariantData(block, 'table')

            // Assert — 5 unique features, insertion order preserved
            expect(result.featureMatrix).toHaveLength(5)
            const names = result.featureMatrix?.map(r => r.featureName)
            expect(names).toEqual(['Feature 1', 'Feature 2', 'Feature 3', 'Feature 4', 'Feature 5'])
        })

        it('TC-F05-891.124: each row reflects which plans include that feature', () => {
            // Arrange
            const block: PricingConfig = {
                blockType: 'pricing',
                variant: 'cards',
                plans: [
                    {
                        name: 'Plan 1',
                        price: '$5',
                        ctaLabel: 'Get',
                        ctaUrl: '/',
                        features: [
                            { text: 'API Access', included: true },
                            { text: 'Analytics', included: false },
                        ],
                    },
                    {
                        name: 'Plan 2',
                        price: '$15',
                        ctaLabel: 'Get',
                        ctaUrl: '/',
                        features: [
                            { text: 'API Access', included: true },
                            { text: 'Analytics', included: true },
                        ],
                    },
                ],
            }

            // Act
            const result = mapVariantData(block, 'table')

            // Assert — API Access in both, Analytics only in Plan 2
            expect(result.featureMatrix?.[0]).toEqual({
                featureName: 'API Access',
                values: [{ included: true }, { included: true }],
            })
            expect(result.featureMatrix?.[1]).toEqual({
                featureName: 'Analytics',
                values: [{ included: false }, { included: true }],
            })
        })

        it('TC-F05-891.125: preserves feature ordering (insertion order from plans)', () => {
            // Arrange — plans introduce features in specific order
            const block: PricingConfig = {
                blockType: 'pricing',
                variant: 'cards',
                plans: [
                    {
                        name: 'P1',
                        price: '$1',
                        ctaLabel: 'Go',
                        ctaUrl: '/',
                        features: [
                            { text: 'Zebra', included: true },
                            { text: 'Apple', included: true },
                            { text: 'Banana', included: true },
                        ],
                    },
                ],
            }

            // Act
            const result = mapVariantData(block, 'table')

            // Assert — ordering should be Zebra, Apple, Banana (insertion order, not alphabetical)
            const names = result.featureMatrix?.map(r => r.featureName)
            expect(names).toEqual(['Zebra', 'Apple', 'Banana'])
        })

        it('TC-F05-891.126: returns empty object when featureMatrix already populated', () => {
            // Arrange — featureMatrix is not empty, so Standard→Matrix should be no-op
            const block: PricingConfig = {
                blockType: 'pricing',
                variant: 'cards',
                plans: [
                    {
                        name: 'Plan A',
                        price: '$10',
                        ctaLabel: 'Buy',
                        ctaUrl: '/',
                        features: [{ text: 'Feature', included: true }],
                    },
                ],
                featureMatrix: [
                    { featureName: 'Feature', values: [{ included: true }] },
                ],
            }

            // Act
            const result = mapVariantData(block, 'table')

            // Assert — no-op because featureMatrix is already populated
            expect(result).toEqual({})
        })

        it('TC-F05-891.127: handles plans with missing or empty features array', () => {
            // Arrange
            const block: PricingConfig = {
                blockType: 'pricing',
                variant: 'cards',
                plans: [
                    {
                        name: 'Plan A',
                        price: '$10',
                        ctaLabel: 'Buy',
                        ctaUrl: '/',
                        features: [{ text: 'Feature A', included: true }],
                    },
                    {
                        name: 'Plan B',
                        price: '$20',
                        ctaLabel: 'Buy',
                        ctaUrl: '/',
                        features: [],
                    },
                ],
            }

            // Act
            const result = mapVariantData(block, 'table')

            // Assert — Plan B has no features, so Feature A is only in Plan A
            expect(result.featureMatrix).toHaveLength(1)
            expect(result.featureMatrix?.[0]).toEqual({
                featureName: 'Feature A',
                values: [{ included: true }, { included: false }],
            })
        })

        it('TC-F05-891.128: handles string features (legacy format without included property)', () => {
            // Arrange — some plans use string features instead of objects
            const block: PricingConfig = {
                blockType: 'pricing',
                variant: 'cards',
                plans: [
                    {
                        name: 'Plan A',
                        price: '$10',
                        ctaLabel: 'Buy',
                        ctaUrl: '/',
                        features: ['Feature A', 'Feature B'] as any,
                    },
                    {
                        name: 'Plan B',
                        price: '$20',
                        ctaLabel: 'Buy',
                        ctaUrl: '/',
                        features: [{ text: 'Feature A', included: true }],
                    },
                ],
            }

            // Act
            const result = mapVariantData(block, 'table')

            // Assert — string features treated as included: true
            expect(result.featureMatrix).toHaveLength(2)
            expect(result.featureMatrix?.[0].values).toEqual([
                { included: true },
                { included: true },
            ])
            expect(result.featureMatrix?.[1].values).toEqual([
                { included: true },
                { included: false },
            ])
        })

        it('TC-F05-891.129: toggle → table builds featureMatrix from plan.features', () => {
            // Arrange
            const block: PricingConfig = {
                blockType: 'pricing',
                variant: 'toggle',
                plans: [
                    {
                        name: 'Monthly',
                        price: '$30',
                        ctaLabel: 'Subscribe',
                        ctaUrl: '/',
                        features: [
                            { text: 'Cloud Storage', included: true },
                            { text: 'Support', included: true },
                        ],
                    },
                    {
                        name: 'Yearly',
                        price: '$300',
                        ctaLabel: 'Subscribe',
                        ctaUrl: '/',
                        features: [
                            { text: 'Cloud Storage', included: true },
                            { text: 'Support', included: true },
                            { text: 'Priority Support', included: true },
                        ],
                    },
                ],
            }

            // Act
            const result = mapVariantData(block, 'comparison')

            // Assert
            expect(result.featureMatrix).toHaveLength(3)
            expect(result.featureMatrix?.map(r => r.featureName)).toEqual([
                'Cloud Storage',
                'Support',
                'Priority Support',
            ])
        })
    })

    // ─────────────────────────────────────────────────────────────────────
    describe('Branch 2: Matrix → Standard (table/comparison → cards/horizontal/toggle)', () => {
        it('TC-F05-891.130: table → cards fills plan.features from featureMatrix when empty', () => {
            // Arrange
            const block: PricingConfig = {
                blockType: 'pricing',
                variant: 'table',
                plans: [
                    {
                        name: 'Basic',
                        price: '$10',
                        ctaLabel: 'Buy',
                        ctaUrl: '/',
                        features: [],
                    },
                    {
                        name: 'Pro',
                        price: '$30',
                        ctaLabel: 'Buy',
                        ctaUrl: '/',
                        features: [],
                    },
                ],
                featureMatrix: [
                    { featureName: 'Feature 1', values: [{ included: true }, { included: false }] },
                    { featureName: 'Feature 2', values: [{ included: true }, { included: true }] },
                    { featureName: 'Feature 3', values: [{ included: false }, { included: true }] },
                ],
            }

            // Act
            const result = mapVariantData(block, 'cards')

            // Assert — each plan filled with features where included=true for that plan
            expect(result.plans).toBeDefined()
            expect(result.plans?.[0].features).toEqual([
                { text: 'Feature 1', included: true },
                { text: 'Feature 2', included: true },
            ])
            expect(result.plans?.[1].features).toEqual([
                { text: 'Feature 2', included: true },
                { text: 'Feature 3', included: true },
            ])
        })

        it('TC-F05-891.131: comparison → horizontal fills plan.features', () => {
            // Arrange
            const block: PricingConfig = {
                blockType: 'pricing',
                variant: 'comparison',
                plans: [
                    {
                        name: 'Starter',
                        price: '$5',
                        ctaLabel: 'Start',
                        ctaUrl: '/',
                        features: [],
                    },
                    {
                        name: 'Professional',
                        price: '$25',
                        ctaLabel: 'Choose',
                        ctaUrl: '/',
                        features: [],
                    },
                    {
                        name: 'Enterprise',
                        price: 'Custom',
                        ctaLabel: 'Contact',
                        ctaUrl: '/',
                        features: [],
                    },
                ],
                featureMatrix: [
                    {
                        featureName: 'API',
                        values: [
                            { included: false },
                            { included: true },
                            { included: true },
                        ],
                    },
                    {
                        featureName: 'Support',
                        values: [
                            { included: false },
                            { included: false },
                            { included: true },
                        ],
                    },
                ],
            }

            // Act
            const result = mapVariantData(block, 'horizontal')

            // Assert
            expect(result.plans?.[0].features).toEqual([])
            expect(result.plans?.[1].features).toEqual([
                { text: 'API', included: true },
            ])
            expect(result.plans?.[2].features).toEqual([
                { text: 'API', included: true },
                { text: 'Support', included: true },
            ])
        })

        it('TC-F05-891.132: preserves plans that already have features (no overwrite)', () => {
            // Arrange — Plan 1 already has features, Plan 2 doesn't
            const existingFeature = { text: 'Custom Feature', included: true }
            const block: PricingConfig = {
                blockType: 'pricing',
                variant: 'table',
                plans: [
                    {
                        name: 'Plan A',
                        price: '$10',
                        ctaLabel: 'Buy',
                        ctaUrl: '/',
                        features: [existingFeature],
                    },
                    {
                        name: 'Plan B',
                        price: '$20',
                        ctaLabel: 'Buy',
                        ctaUrl: '/',
                        features: [],
                    },
                ],
                featureMatrix: [
                    {
                        featureName: 'Matrix Feature',
                        values: [{ included: true }, { included: true }],
                    },
                ],
            }

            // Act
            const result = mapVariantData(block, 'cards')

            // Assert — Plan A unchanged, Plan B filled from matrix
            expect(result.plans?.[0].features).toEqual([existingFeature])
            expect(result.plans?.[1].features).toEqual([
                { text: 'Matrix Feature', included: true },
            ])
        })

        it('TC-F05-891.133: returns unchanged plans when all plans already have features', () => {
            // Arrange
            const block: PricingConfig = {
                blockType: 'pricing',
                variant: 'table',
                plans: [
                    {
                        name: 'Plan A',
                        price: '$10',
                        ctaLabel: 'Buy',
                        ctaUrl: '/',
                        features: [{ text: 'Existing', included: true }],
                    },
                    {
                        name: 'Plan B',
                        price: '$20',
                        ctaLabel: 'Buy',
                        ctaUrl: '/',
                        features: [{ text: 'Existing', included: true }],
                    },
                ],
                featureMatrix: [
                    {
                        featureName: 'New Feature',
                        values: [{ included: true }, { included: false }],
                    },
                ],
            }

            // Act
            const result = mapVariantData(block, 'cards')

            // Assert — early-return when all plans already have features (no spurious undo entry)
            expect(result).toEqual({})
            expect(result.plans).toBeUndefined()
        })

        it('TC-F05-891.134: handles empty featureMatrix', () => {
            // Arrange
            const block: PricingConfig = {
                blockType: 'pricing',
                variant: 'table',
                plans: [
                    {
                        name: 'Plan A',
                        price: '$10',
                        ctaLabel: 'Buy',
                        ctaUrl: '/',
                        features: [],
                    },
                    {
                        name: 'Plan B',
                        price: '$20',
                        ctaLabel: 'Buy',
                        ctaUrl: '/',
                        features: [],
                    },
                ],
                featureMatrix: [],
            }

            // Act
            const result = mapVariantData(block, 'cards')

            // Assert — plans filled with empty features
            expect(result.plans?.[0].features).toEqual([])
            expect(result.plans?.[1].features).toEqual([])
        })

        it('TC-F05-891.135: handles featureMatrix with rows out of plan count sync', () => {
            // Arrange — matrix has 3 columns but only 2 plans
            const block: PricingConfig = {
                blockType: 'pricing',
                variant: 'table',
                plans: [
                    {
                        name: 'Plan A',
                        price: '$10',
                        ctaLabel: 'Buy',
                        ctaUrl: '/',
                        features: [],
                    },
                    {
                        name: 'Plan B',
                        price: '$20',
                        ctaLabel: 'Buy',
                        ctaUrl: '/',
                        features: [],
                    },
                ],
                featureMatrix: [
                    {
                        featureName: 'Feature',
                        values: [
                            { included: true },
                            { included: true },
                            { included: true },
                        ],
                    },
                ],
            }

            // Act
            const result = mapVariantData(block, 'cards')

            // Assert — only use values indices that exist for plans
            expect(result.plans?.[0].features).toEqual([
                { text: 'Feature', included: true },
            ])
            expect(result.plans?.[1].features).toEqual([
                { text: 'Feature', included: true },
            ])
        })

        it('TC-F05-891.136: table → toggle fills features from comparison matrix', () => {
            // Arrange
            const block: PricingConfig = {
                blockType: 'pricing',
                variant: 'comparison',
                plans: [
                    {
                        name: 'Monthly',
                        price: '$30',
                        ctaLabel: 'Subscribe',
                        ctaUrl: '/',
                        features: [],
                    },
                    {
                        name: 'Yearly',
                        price: '$300',
                        ctaLabel: 'Subscribe',
                        ctaUrl: '/',
                        features: [],
                    },
                ],
                featureMatrix: [
                    {
                        featureName: 'Basic Support',
                        values: [{ included: true }, { included: true }],
                    },
                    {
                        featureName: 'Priority Support',
                        values: [{ included: false }, { included: true }],
                    },
                ],
            }

            // Act
            const result = mapVariantData(block, 'toggle')

            // Assert
            expect(result.plans?.[0].features).toEqual([
                { text: 'Basic Support', included: true },
            ])
            expect(result.plans?.[1].features).toEqual([
                { text: 'Basic Support', included: true },
                { text: 'Priority Support', included: true },
            ])
        })
    })

    // ─────────────────────────────────────────────────────────────────────
    describe('Branch 3: Same Group No-Op (both Standard or both Matrix)', () => {
        it('TC-F05-891.137: cards → horizontal returns empty object (both Standard)', () => {
            // Arrange
            const block: PricingConfig = {
                blockType: 'pricing',
                variant: 'cards',
                plans: [
                    {
                        name: 'Plan A',
                        price: '$10',
                        ctaLabel: 'Buy',
                        ctaUrl: '/',
                        features: [{ text: 'Feature', included: true }],
                    },
                ],
            }

            // Act
            const result = mapVariantData(block, 'horizontal')

            // Assert
            expect(result).toEqual({})
        })

        it('TC-F05-891.138: horizontal → toggle returns empty object (both Standard)', () => {
            // Arrange
            const block: PricingConfig = {
                blockType: 'pricing',
                variant: 'horizontal',
                plans: [
                    {
                        name: 'Plan',
                        price: '$15',
                        ctaLabel: 'Go',
                        ctaUrl: '/',
                        features: [],
                    },
                ],
            }

            // Act
            const result = mapVariantData(block, 'toggle')

            // Assert
            expect(result).toEqual({})
        })

        it('TC-F05-891.139: toggle → cards returns empty object (both Standard)', () => {
            // Arrange
            const block: PricingConfig = {
                blockType: 'pricing',
                variant: 'toggle',
                plans: [
                    {
                        name: 'Plan A',
                        price: '$20',
                        ctaLabel: 'Select',
                        ctaUrl: '/',
                        features: [],
                    },
                ],
            }

            // Act
            const result = mapVariantData(block, 'cards')

            // Assert
            expect(result).toEqual({})
        })

        it('TC-F05-891.140: table → comparison returns empty object (both Matrix)', () => {
            // Arrange
            const block: PricingConfig = {
                blockType: 'pricing',
                variant: 'table',
                plans: [
                    {
                        name: 'Plan A',
                        price: '$10',
                        ctaLabel: 'Buy',
                        ctaUrl: '/',
                        features: [],
                    },
                ],
                featureMatrix: [
                    {
                        featureName: 'Feature',
                        values: [{ included: true }],
                    },
                ],
            }

            // Act
            const result = mapVariantData(block, 'comparison')

            // Assert
            expect(result).toEqual({})
        })

        it('TC-F05-891.141: comparison → table returns empty object (both Matrix)', () => {
            // Arrange
            const block: PricingConfig = {
                blockType: 'pricing',
                variant: 'comparison',
                plans: [
                    {
                        name: 'Plan A',
                        price: '$10',
                        ctaLabel: 'Buy',
                        ctaUrl: '/',
                        features: [],
                    },
                ],
                featureMatrix: [
                    {
                        featureName: 'Feature',
                        values: [{ included: true }],
                    },
                ],
            }

            // Act
            const result = mapVariantData(block, 'table')

            // Assert
            expect(result).toEqual({})
        })
    })

    // ─────────────────────────────────────────────────────────────────────
    describe('Branch 4: Idempotency (applying mapping twice yields no-op)', () => {
        it('TC-F05-891.142: Standard→Matrix mapping is idempotent', () => {
            // Arrange
            const block: PricingConfig = {
                blockType: 'pricing',
                variant: 'cards',
                plans: [
                    {
                        name: 'Plan A',
                        price: '$10',
                        ctaLabel: 'Buy',
                        ctaUrl: '/',
                        features: [
                            { text: 'Feature 1', included: true },
                            { text: 'Feature 2', included: true },
                        ],
                    },
                    {
                        name: 'Plan B',
                        price: '$20',
                        ctaLabel: 'Buy',
                        ctaUrl: '/',
                        features: [
                            { text: 'Feature 1', included: true },
                        ],
                    },
                ],
            }

            // Act — first mapping: Standard→Matrix
            const step1 = mapVariantData(block, 'table')

            // Create updated block with result from step1
            const updatedBlock: PricingConfig = {
                ...block,
                variant: 'table',
                featureMatrix: step1.featureMatrix,
            }

            // Act — apply Standard→Matrix again (should be no-op because featureMatrix now populated)
            const step2 = mapVariantData(updatedBlock, 'comparison')

            // Assert — second Standard→Matrix application returns empty object
            expect(step2).toEqual({})
        })

        it('TC-F05-891.143: Matrix→Standard mapping is idempotent', () => {
            // Arrange
            const block: PricingConfig = {
                blockType: 'pricing',
                variant: 'table',
                plans: [
                    {
                        name: 'Plan A',
                        price: '$10',
                        ctaLabel: 'Buy',
                        ctaUrl: '/',
                        features: [],
                    },
                    {
                        name: 'Plan B',
                        price: '$20',
                        ctaLabel: 'Buy',
                        ctaUrl: '/',
                        features: [],
                    },
                ],
                featureMatrix: [
                    {
                        featureName: 'Feature 1',
                        values: [{ included: true }, { included: false }],
                    },
                    {
                        featureName: 'Feature 2',
                        values: [{ included: true }, { included: true }],
                    },
                ],
            }

            // Act — first mapping
            const step1 = mapVariantData(block, 'cards')

            // Create updated block with result from step1
            const updatedBlock: PricingConfig = {
                ...block,
                variant: 'cards',
                plans: step1.plans || block.plans,
            }

            // Act — apply mapping back to table (should recognize plans already have features)
            const step2 = mapVariantData(updatedBlock, 'table')

            // Assert — second application is no-op because plans now have features
            expect(step2).toEqual({})
        })

        it('TC-F05-891.144: Round-trip Standard→Matrix→Standard with cleared features fills from matrix', () => {
            // Arrange
            const block: PricingConfig = {
                blockType: 'pricing',
                variant: 'cards',
                plans: [
                    {
                        name: 'Plan A',
                        price: '$10',
                        ctaLabel: 'Buy',
                        ctaUrl: '/',
                        features: [
                            { text: 'Feature X', included: true },
                            { text: 'Feature Y', included: false },
                        ],
                    },
                    {
                        name: 'Plan B',
                        price: '$20',
                        ctaLabel: 'Buy',
                        ctaUrl: '/',
                        features: [
                            { text: 'Feature X', included: true },
                        ],
                    },
                ],
            }

            // Act — Standard → Matrix
            const step1 = mapVariantData(block, 'table')
            expect(step1.featureMatrix).toHaveLength(2)
            expect(step1.featureMatrix?.map(r => r.featureName)).toEqual([
                'Feature X',
                'Feature Y',
            ])

            // Simulate clearing features to trigger fill-from-matrix behavior
            const blockAfterToTable: PricingConfig = {
                ...block,
                variant: 'table',
                featureMatrix: step1.featureMatrix,
                plans: [
                    { ...block.plans[0], features: [] },
                    { ...block.plans[1], features: [] },
                ],
            }

            // Act — Matrix → Standard (with cleared features, should fill from matrix)
            const step2 = mapVariantData(blockAfterToTable, 'cards')
            const blockAfterToCards: PricingConfig = {
                ...blockAfterToTable,
                variant: 'cards',
                plans: step2.plans || blockAfterToTable.plans,
            }

            // Assert — Matrix→Standard fills only rows where included=true for that plan
            // Plan A: Feature X (true), Feature Y (false) — only Feature X filled
            expect(blockAfterToCards.plans[0].features).toEqual([
                { text: 'Feature X', included: true },
            ])
            // Plan B: Feature X (true)
            expect(blockAfterToCards.plans[1].features).toEqual([
                { text: 'Feature X', included: true },
            ])
        })

        it('TC-F05-891.145: Mapping with missing featureMatrix variants treated as empty', () => {
            // Arrange — block may not have featureMatrix property at all
            const block: PricingConfig = {
                blockType: 'pricing',
                variant: 'cards',
                plans: [
                    {
                        name: 'Plan',
                        price: '$10',
                        ctaLabel: 'Buy',
                        ctaUrl: '/',
                        features: [{ text: 'Feature', included: true }],
                    },
                ],
            }

            // Act
            const result = mapVariantData(block, 'table')

            // Assert — undefined featureMatrix treated as empty, so mapping proceeds
            expect(result.featureMatrix).toBeDefined()
            expect(result.featureMatrix).toHaveLength(1)
        })

        it('TC-F05-891.146: Mapping with no plans returns empty result', () => {
            // Arrange
            const block: PricingConfig = {
                blockType: 'pricing',
                variant: 'cards',
                plans: [],
            }

            // Act
            const result = mapVariantData(block, 'table')

            // Assert — no plans means no features to derive
            expect(result.featureMatrix).toEqual([])
        })
    })

    // ─────────────────────────────────────────────────────────────────────
    describe('Edge Cases & Special Scenarios', () => {
        it('TC-F05-891.147: handles feature text extraction from mixed feature formats', () => {
            // Arrange — mix of string and object features
            const block: PricingConfig = {
                blockType: 'pricing',
                variant: 'cards',
                plans: [
                    {
                        name: 'Plan A',
                        price: '$10',
                        ctaLabel: 'Buy',
                        ctaUrl: '/',
                        features: [
                            'String Feature',
                            { text: 'Object Feature', included: true },
                        ] as any,
                    },
                ],
            }

            // Act
            const result = mapVariantData(block, 'table')

            // Assert — both extracted with correct text
            const names = result.featureMatrix?.map(r => r.featureName)
            expect(names).toEqual(['String Feature', 'Object Feature'])
        })

        it('TC-F05-891.148: feature with included=false is still tracked in matrix', () => {
            // Arrange
            const block: PricingConfig = {
                blockType: 'pricing',
                variant: 'cards',
                plans: [
                    {
                        name: 'Plan A',
                        price: '$10',
                        ctaLabel: 'Buy',
                        ctaUrl: '/',
                        features: [
                            { text: 'Feature', included: false },
                        ],
                    },
                ],
            }

            // Act
            const result = mapVariantData(block, 'table')

            // Assert — feature is tracked with included=false
            expect(result.featureMatrix).toHaveLength(1)
            expect(result.featureMatrix?.[0].values[0].included).toBe(false)
        })

        it('TC-F05-891.149: plans array is optional, defaults to empty', () => {
            // Arrange
            const block: Partial<PricingConfig> = {
                blockType: 'pricing',
                variant: 'cards',
            }

            // Act
            const result = mapVariantData(block as PricingConfig, 'table')

            // Assert — undefined plans treated as []
            expect(result.featureMatrix).toEqual([])
        })

        it('TC-F05-891.150: complex multi-plan scenario with partial feature inclusion', () => {
            // Arrange
            const block: PricingConfig = {
                blockType: 'pricing',
                variant: 'cards',
                plans: [
                    {
                        name: 'Free',
                        price: '$0',
                        ctaLabel: 'Start',
                        ctaUrl: '/',
                        features: [
                            { text: 'Basic Auth', included: true },
                            { text: 'API Access', included: false },
                        ],
                    },
                    {
                        name: 'Pro',
                        price: '$29',
                        ctaLabel: 'Upgrade',
                        ctaUrl: '/',
                        features: [
                            { text: 'Basic Auth', included: true },
                            { text: 'API Access', included: true },
                            { text: 'Priority Support', included: true },
                        ],
                    },
                    {
                        name: 'Enterprise',
                        price: 'Custom',
                        ctaLabel: 'Contact',
                        ctaUrl: '/',
                        features: [
                            { text: 'Basic Auth', included: true },
                            { text: 'API Access', included: true },
                            { text: 'Priority Support', included: true },
                            { text: 'SLA', included: true },
                        ],
                    },
                ],
            }

            // Act
            const result = mapVariantData(block, 'comparison')

            // Assert
            expect(result.featureMatrix).toHaveLength(4)
            const rows = result.featureMatrix!
            expect(rows[0]).toEqual({
                featureName: 'Basic Auth',
                values: [{ included: true }, { included: true }, { included: true }],
            })
            expect(rows[1]).toEqual({
                featureName: 'API Access',
                values: [{ included: false }, { included: true }, { included: true }],
            })
            expect(rows[2]).toEqual({
                featureName: 'Priority Support',
                values: [{ included: false }, { included: true }, { included: true }],
            })
            expect(rows[3]).toEqual({
                featureName: 'SLA',
                values: [{ included: false }, { included: false }, { included: true }],
            })
        })
    })
})
