// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { emptyStore, type Row } from '@/lib/migration/pw1-export/contracts'
import { sourceConfigSchema } from '@/lib/migration/pw1-export/source-config'
import { SourceIndex } from '@/lib/migration/pw1-export/source-index'
import { mapLibraryMedia } from '@/lib/migration/pw1-export/mappers/library-media'
import { mapSocialLinks } from '@/lib/migration/pw1-export/mappers/social-links'

function context(tables: Record<string, Row[]> = {}) {
  const config = sourceConfigSchema.parse({ version: 1, sourceInstance: 'test', sourceDatabase: 'test', sourceInstanceToken: 'test', snapshotId: 'one', asOf: '2026-01-01T00:00:00Z', utcOffset: '+00:00', sourcePlatformSuffix: 'old.test', targetPlatformSuffix: 'new.test', tables: { stores: 'stores.csv' }, deletedStores: 'review' })
  return new SourceIndex({ stores: [{ id: '10' }], ...tables }).context(config, '10', emptyStore(), [], [])
}

describe('[TC-F42-EXP-110] Supported social fields and original media URLs', () => {
  it('maps supported social URLs exactly and ignores PW1 display metadata', () => {
    // Arrange
    const ctx = context()
    const facebook = 'https://www.facebook.com/Page?ref=PW1#about'
    const twitter = 'https://x.com/OriginalCase'
    const store = { id: '10', social_channel: JSON.stringify([{ id: 1, url: facebook, image: 'PW1-icon', signature: 'PW1-signature' }, { url: twitter }]) }
    // Act
    const result = mapSocialLinks(ctx, store)
    // Assert
    expect(result).toEqual({ facebook, twitter })
    expect(JSON.stringify(result)).not.toMatch(/PW1-icon|PW1-signature/)
    expect(ctx.diagnostics.some(d => d.severity === 'blocker')).toBe(false)
  })
  it('keeps the first platform entry and never treats lookalike or inherited host keys as supported', () => {
    // Arrange
    const ctx = context()
    const entries = ['https://facebook.com/first', 'https://facebook.com/second', 'https://facebook.com.evil.test/page', 'https://constructor/', 'https://__proto__/'].map(url => ({ url }))
    // Act
    const result = mapSocialLinks(ctx, { id: '10', social_channel: JSON.stringify(entries) })
    // Assert
    expect(result).toEqual({ facebook: 'https://facebook.com/first' })
    expect(ctx.diagnostics).toContainEqual(expect.objectContaining({ reason: 'DUPLICATE_PLATFORM_FIRST_RETAINED', severity: 'warning' }))
    expect(ctx.diagnostics.some(d => d.severity === 'blocker')).toBe(false)
  })
  it.each(['{broken', '{}', '[{"url":"javascript:alert(1)"}]', '[{"url":"https://username:password@facebook.com/a"}]'])('omits malformed/unsafe social data without mapping the unsafe URL: %s', social_channel => {
    // Arrange
    const ctx = context()
    // Act
    const result = mapSocialLinks(ctx, { id: '10', social_channel })
    // Assert
    expect(result).toEqual({})
    expect(ctx.diagnostics).toContainEqual(expect.objectContaining({ code: 'SOCIAL_CHANNEL_INVALID', severity: 'warning', reason: 'SOURCE_ENTRY_OMITTED' }))
  })
  it('maps standalone media URLs verbatim without filename, inferred MIME or cross-tenant rows', () => {
    // Arrange
    const url = 'https://Legacy.EXAMPLE.test/assets/A%2Fb.PNG?w=100'
    const ctx = context({ medias: [
      { id: '1252', store_id: '10', type: '1', name: 'Original label', url, created_at: '2025-01-01 00:00:00', updated_at: '2025-01-02 00:00:00' },
      { id: '1253', store_id: '99', type: '1', name: 'Foreign', url: 'https://other.test/b.png' },
    ] })
    // Act
    mapLibraryMedia(ctx)
    // Assert
    expect(ctx.output.media).toHaveLength(1)
    expect(ctx.output.media[0]).toMatchObject({ _ref: '@media:medias:1252', url, sourceUrl: url, alt: 'Original label', createdAt: '2025-01-01T00:00:00.000Z' })
    expect(ctx.output.media[0]).not.toHaveProperty('filename')
    expect(ctx.output.media[0]).not.toHaveProperty('mimeType')
    expect(ctx.contributions.every(c => c.sourceId === '1252')).toBe(true)
    expect(ctx.diagnostics).toEqual([])
  })
  it('retains folder/deleted/empty URL rows as source-only and gives unnamed files an explicit ID label', () => {
    // Arrange
    const ctx = context({ medias: [
      { id: '1', store_id: '10', type: '2', name: 'Folder', url: null },
      { id: '2', store_id: '10', type: '1', url: 'https://old.test/deleted.png', deleted_at: '2020-01-01' },
      { id: '3', store_id: '10', type: '1', url: '' },
      { id: '4', store_id: '10', type: '1', url: 'https://old.test/kept.png', name: '' },
    ] })
    // Act
    mapLibraryMedia(ctx)
    // Assert
    expect(ctx.output.media).toEqual([{ _ref: '@media:medias:4', url: 'https://old.test/kept.png', sourceUrl: 'https://old.test/kept.png', alt: 'Media 4' }])
    expect(ctx.diagnostics.map(d => d.reason)).toEqual(['FOLDER', 'DELETED', 'EMPTY_URL'])
    expect(ctx.diagnostics.every(d => d.severity === 'warning')).toBe(true)
  })
  it.each(['javascript:alert(1)', 'https://user:pass@example.test/a.png', 'https://example.test/a.png?token=private'])('retains a blocker for unsafe or signed media URL: %s', url => {
    // Arrange
    const ctx = context({ medias: [{ id: '1', store_id: '10', type: '1', url }] })
    // Act
    mapLibraryMedia(ctx)
    // Assert
    expect(ctx.output.media).toEqual([])
    expect(ctx.contributions).toEqual([])
    expect(ctx.diagnostics).toContainEqual(expect.objectContaining({ code: 'MEDIA_URL_INVALID', severity: 'blocker' }))
    expect(JSON.stringify(ctx.diagnostics)).not.toContain('private')
  })
})
