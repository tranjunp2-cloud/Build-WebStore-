// @vitest-environment node
import { describe, it, expect } from 'vitest'
import { targetProjectionMatches } from '@/lib/migration/pw1-json/projection'
import { normalizeDashboardBlocks } from '@/lib/dashboard-utils'

describe('[TC-F42-IMP-LEGACY-DASHBOARD] Legacy tenant projection', () => {
  it('accepts the same rendered defaults without mutating the saved object', () => {
    // Arrange
    const actual = { settings: { dashboardPreferences: { legacy: true }, allowedWebsites: 1 } }
    const before = JSON.stringify(actual)
    // Act / Assert
    expect(targetProjectionMatches({ settings: { dashboardPreferences: normalizeDashboardBlocks({}), allowedWebsites: 1 } }, actual)).toBe(true)
    expect(JSON.stringify(actual)).toBe(before)
  })
  it('rejects changed custom block lists and other settings', () => {
    // Arrange
    const actual = { settings: { dashboardPreferences: {}, allowedWebsites: 2 } }
    // Act / Assert
    expect(targetProjectionMatches({ settings: { dashboardPreferences: ['seo'] } }, actual)).toBe(false)
    expect(targetProjectionMatches({ settings: { dashboardPreferences: normalizeDashboardBlocks({}), allowedWebsites: 1 } }, actual)).toBe(false)
  })
})
