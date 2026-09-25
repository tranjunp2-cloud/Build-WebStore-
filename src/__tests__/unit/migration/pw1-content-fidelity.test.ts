import { describe, expect, it } from 'vitest'
import { contentStyle } from '@/lib/migration/pw1-export/mappers/content-style'
import { isSafeContentLink } from '@/lib/migration/pw1-export/mappers/content-link'
import { safeUrl } from '@/lib/migration/pw1-export/primitives'
import { productLexical } from '@/lib/migration/pw1-export/mappers/product-lexical'
import { blogLexical } from '@/lib/migration/pw1-export/mappers/content-lexical'
import { emptyStore } from '@/lib/migration/pw1-export/contracts'
import { SourceIndex } from '@/lib/migration/pw1-export/source-index'
import { sourceConfigSchema } from '@/lib/migration/pw1-export/source-config'

function context() {
  return new SourceIndex({}).context(sourceConfigSchema.parse({
    version: 1, sourceInstance: 'fixture', sourceDatabase: 'fixture', sourceInstanceToken: 'fixture',
    snapshotId: 'one', asOf: '2026-01-01T00:00:00Z', utcOffset: '+00:00',
    sourcePlatformSuffix: 'old.test', targetPlatformSuffix: 'new.test',
    tables: { stores: 'stores.csv' }, deletedStores: 'review',
  }), '1', emptyStore(), [], [])
}

describe('[TC-F42-057] CSS fidelity reflects discarded declarations', () => {
  it('retains harmless spacing and trailing separator changes in both converters', () => {
    // Arrange
    const ctx = context()
    const html = '<p style=" color : red;font-size:12px; ; ">Hello</p>'
    // Act
    const product = productLexical(ctx, { id: '1', description: html }, 'description')
    const blog = blogLexical(ctx, { id: '2', content: html })
    // Assert
    expect(ctx.diagnostics).toEqual([])
    expect(product).toMatchObject({ root: { children: [{ children: [{ text: html }] }] } })
    expect(blog).toMatchObject({ root: { children: [{ children: [{ text: html }] }] } })
  })
  it.each(['font-family:Arial', 'background-image:url(https://example.test/a)', 'color:expression(alert(1))'])('still flags unsupported or unsafe declaration %s', (declaration) => {
    // Arrange
    const source = `color:red;${declaration}`
    // Act
    const result = contentStyle(source)
    // Assert
    expect(result).toEqual({ style: 'color:red', lostDeclarations: true })
  })
})

describe('[TC-F42-058] Navigation links remain separate from media URLs', () => {
  it.each(['https://example.test/help#delivery', '../help#delivery', '/products?page=2&sort=name', 'https://example.test/?utm_source=mail', 'mailto:support@example.test', 'tel:+60123456789'])('preserves navigation %s', (link) => {
    // Arrange / Act
    const result = isSafeContentLink(link)
    // Assert
    expect(result).toBe(true)
  })
  it.each(['javascript:alert(1)', 'data:text/html,x', '//evil.test', 'https://user:pass@example.test', 'https://example.test/?token=x', '/?X-Amz-Signature=x', '/?redirect=https://evil.test', '/?%2574oken=x', '/?q=token%3Dx', 'mailto:a@example.test?bcc=b@example.test', 'mailto:a@example.test%0d%0aBcc:b@example.test', '/%255c/evil.test', 'https:evil.test', 'https://example.test/#token=x'])('rejects unsafe or unverified navigation %s', (link) => {
    // Arrange / Act
    const result = isSafeContentLink(link)
    // Assert
    expect(result).toBe(false)
  })
  it('retains source anchors as text without weakening media validation', () => {
    // Arrange
    const ctx = context()
    const link = 'https://example.test/help#delivery'
    // Act
    const doc = productLexical(ctx, { id: '1', description: `<p><a href="${link}">Help</a></p>` }, 'description')
    // Assert
    expect(JSON.stringify(doc)).toContain(link)
    expect(ctx.diagnostics).toEqual([])
    expect(() => safeUrl(link)).toThrow()
  })
})
