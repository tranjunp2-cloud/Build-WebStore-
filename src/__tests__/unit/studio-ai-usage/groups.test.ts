import { describe, expect, it } from 'vitest'
import { areaGroupOf, areaGroupSql, isAreaGroup, planGroupOf, planGroupSql } from '@/lib/admin/ai-usage/groups'
import { render } from './fake-db'

describe('TC-AIS-OV-005 area grouping', () => {
    it.each([
        [{ area: 'website-setup', feature: 'pictures' }, 'website-setup'], // area rules win over feature
        [{ area: 'migration', feature: 'writing' }, 'migration'],
        [{ area: 'background', feature: 'assistant' }, 'background'],
        [{ area: 'products', feature: 'pictures' }, 'pictures'],
        [{ area: 'products', feature: 'writing' }, 'writing'],
        [{ area: 'dashboard', feature: 'assistant' }, 'assistant'],
        [{ area: null, feature: null }, 'assistant'],
        [{ area: 'other', feature: 'other' }, 'assistant'],
    ])('%j -> %s (each call in exactly one group)', (row, group) => {
        expect(areaGroupOf(row)).toBe(group)
    })

    it('renders the same rules, in the same order, as a SQL CASE', () => {
        const { sql, params } = render(areaGroupSql())
        expect(sql.indexOf('area = $1')).toBeLessThan(sql.indexOf('feature = $7'))
        expect(params).toEqual(['website-setup', 'website-setup', 'migration', 'migration', 'background', 'background', 'pictures', 'pictures', 'writing', 'writing'])
        expect(sql).toContain("ELSE 'assistant'")
    })

    it('validates group keys from the URL', () => {
        expect(isAreaGroup('pictures')).toBe(true)
        expect(isAreaGroup('products')).toBe(false)
    })
})

describe('TC-AIS-OV-006 plan grouping', () => {
    it.each([
        ['FREEMIUM', 'free'], ['STARTER_TM_USER', 'starter'], ['STARTER_NON_TM_USER', 'starter'],
        ['STANDARD_TM_USER', 'standard'], ['STANDARD_NON_TM_USER', 'standard'],
        ['PROFESSIONAL_TM_USER', 'professional'], ['PROFESSIONAL_NON_TM_USER', 'professional'],
    ])('%s -> %s', (code, group) => expect(planGroupOf(code)).toBe(group))

    it('shows NULL and unrecognised codes as Unknown', () => {
        expect(planGroupOf(null)).toBe('unknown')
        expect(planGroupOf(undefined)).toBe('unknown')
        expect(planGroupOf('')).toBe('unknown')
        expect(planGroupOf('STARTER_MONTHLY')).toBe('unknown')
    })

    it('renders a CASE with every code as a parameter and an unknown fallback', () => {
        const { sql, params } = render(planGroupSql())
        expect(params).toContain('STARTER_NON_TM_USER')
        expect(params).toContain('professional')
        expect(sql).toContain("ELSE 'unknown'")
    })
})
