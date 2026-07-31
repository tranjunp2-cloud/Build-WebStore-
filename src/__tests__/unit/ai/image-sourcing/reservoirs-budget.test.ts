// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
    PixabayAttemptBudget,
    normalizeImageDemands,
    planImageReservoirs,
} from '@/lib/ai/image-sourcing'

describe('[TC-F38-RES-01–09] generation reservoir planning', () => {
    it('plans five reservoirs once in fixed order with exact caps and query shapes', () => {
        // Arrange
        const input = {
            counts: { landscape: 20, square: 9, people: 8, products: 7, blogs: 5 },
            category: 'FNB',
            trustedSubjects: ['Bakery'],
            trustedProducts: ['Cupcakes'],
            blogImageKeywords: ['Pastry guide'],
            categoryBaseKeyword: 'restaurant',
        }

        // Act
        const plan = planImageReservoirs(input)

        // Assert
        expect(plan.map(({ kind, count }) => ({ kind, count }))).toEqual([
            { kind: 'landscape', count: 12 },
            { kind: 'square', count: 6 },
            { kind: 'people', count: 6 },
            { kind: 'products', count: 6 },
            { kind: 'blogs', count: 3 },
        ])
        expect(plan.find((item) => item.kind === 'people')).toMatchObject({
            subject: 'professional portrait',
            category: 'people',
            orientation: 'all',
            aiEligible: false,
        })
        expect(plan.find((item) => item.kind === 'products')?.subject).toBe('cupcakes')
        expect(plan.find((item) => item.kind === 'blogs')?.subject).toBe('pastry guide')
    })

    it('skips zero demand and canonicalizes externally supplied demands', () => {
        // Arrange
        const demands = [
            { kind: 'blogs' as const, count: 0, subject: 'Unused', category: 'FNB' },
            { kind: 'people' as const, count: 2, subject: 'Wrong mood', category: 'FNB' },
        ]

        // Act
        const result = normalizeImageDemands(demands)

        // Assert
        expect(result).toHaveLength(1)
        expect(result[0]).toMatchObject({
            kind: 'people',
            subject: 'professional portrait',
            category: 'people',
            count: 2,
        })
    })
})

describe('[TC-F38-BUDGET-01–06] atomic five-attempt budget', () => {
    it('allows at most five reservations across six concurrent callers', async () => {
        // Arrange
        const budget = new PixabayAttemptBudget(5)

        // Act
        const reservations = await Promise.all(
            Array.from({ length: 6 }, async () => {
                await Promise.resolve()
                return budget.reserveFailover()
            }),
        )

        // Assert
        expect(reservations.filter(Boolean)).toHaveLength(5)
        expect(budget.attemptsUsed).toBe(5)
        expect(budget.remaining).toBe(0)
    })

    it('preserves primary attempts for every later unresolved reservoir', () => {
        // Arrange
        const budget = new PixabayAttemptBudget(5)

        // Act
        const first = budget.reservePrimary(4)
        const steal = budget.reservePrimary(4)

        // Assert
        expect(first).toBe(true)
        expect(steal).toBe(false)
        expect(budget.attemptsUsed).toBe(1)
    })
})
