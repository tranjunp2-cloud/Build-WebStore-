import { describe, expect, it } from 'vitest'
import { classifyCodRepair, codRepairPatch, notSelectedReason, parseCodRepairScope, planCodRepair } from '@/lib/migration/pw1-delta/site-cod-repair'

describe('TC-F42-DELTA-12: site COD repair decisions (generated-website sites, #2179)', () => {
  it.each([
    ['import projection false', { importCod: false }, 'PATCH'],
    ['delta projection false', { deltaCod: false, importCod: true }, 'PATCH'],
    ['import projection true (PW2 changed it)', { importCod: true }, 'SKIP_PW2_EDITED'],
    ['delta projection true wins over import false', { deltaCod: true, importCod: false }, 'SKIP_PW2_EDITED'],
    ['nothing recorded', {}, 'SKIP_NO_PROJECTION'],
    ['non-boolean recorded value', { importCod: 'false' }, 'SKIP_NO_PROJECTION'],
  ])('%s → %s', (_name, recorded, expected) => {
    // Arrange / Act
    const decision = classifyCodRepair(recorded)
    // Assert
    expect(decision).toBe(expected)
  })

  it('patches only enableCod and keeps sibling payment fields', () => {
    // Arrange
    const live = { enableCod: false, enableQrBanking: true, merchantQrCode: 77, bankName: 'Maybank', bankAccountNo: '123' }
    // Act
    const patch = codRepairPatch(live)
    // Assert
    expect(patch).toEqual({ paymentConfig: { ...live, enableCod: true } })
    expect(live.enableCod).toBe(false)
  })

  it('builds a full group when the site has no paymentConfig', () => {
    // Arrange / Act / Assert
    expect(codRepairPatch(undefined)).toEqual({ paymentConfig: { enableCod: true } })
    expect(codRepairPatch([])).toEqual({ paymentConfig: { enableCod: true } })
  })

  it('plans every candidate with before=false and its decision', () => {
    // Arrange
    const rows = [
      { storeId: '1329', tenantId: 1457, siteId: 1849, slug: 'de-lettuce-bear-berhad', importCod: false },
      { storeId: '570', tenantId: 566, siteId: 566, slug: 'shop', importCod: true },
    ]
    // Act
    const planned = planCodRepair(rows)
    // Assert
    expect(planned).toEqual([
      { storeId: '1329', tenantId: 1457, siteId: 1849, slug: 'de-lettuce-bear-berhad', decision: 'PATCH', before: false },
      { storeId: '570', tenantId: 566, siteId: 566, slug: 'shop', decision: 'SKIP_PW2_EDITED', before: false },
    ])
  })

  describe('scope', () => {
    it('requires --store or --all', () => {
      expect(() => parseCodRepairScope(undefined, false)).toThrow('SCOPE_REQUIRED')
    })
    it('rejects --store together with --all', () => {
      expect(() => parseCodRepairScope('1', true)).toThrow('SCOPE_CONFLICT')
    })
    it('parses and de-duplicates store ids like the delta (comma separated, trimmed)', () => {
      expect(parseCodRepairScope(' 1329, 2917,,1329 ', false)).toEqual({ all: false, stores: ['1329', '2917'] })
    })
    it.each([['abc'], ['0'], ['12,x'], [' , ']])('rejects invalid store ids %j', value => {
      expect(() => parseCodRepairScope(value, false)).toThrow('STORE_ID_INVALID')
    })
    it('accepts --all', () => {
      expect(parseCodRepairScope(undefined, true)).toEqual({ all: true })
    })
  })

  it.each([
    ['no generated website (delta writes the site itself)', {}, 'NOT_GENERATED'],
    ['website generation not completed', { generationStatus: 'running' }, 'NOT_COMPLETED'],
    ['tenant still suspended (e.g. banned store)', { generationStatus: 'completed', tenantStatus: 'suspended', tenantCod: true }, 'TENANT_NOT_ACTIVE'],
    ['tenant COD off in PW1', { generationStatus: 'completed', tenantStatus: 'active', tenantCod: false }, 'TENANT_COD_OFF'],
    ['site COD already on', { generationStatus: 'completed', tenantStatus: 'active', tenantCod: true, siteCod: true }, 'ALREADY_ENABLED'],
  ])('explains a requested store that is not selected: %s → %s', (_name, state, expected) => {
    // Arrange / Act
    const reason = notSelectedReason({ storeId: '1', ...state })
    // Assert
    expect(reason).toBe(expected)
  })
})
