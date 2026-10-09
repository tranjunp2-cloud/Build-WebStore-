import { describe, it, expect } from 'vitest'
import { pw1SlugCandidate, selectPw1TenantSlug } from '@/lib/migration/pw1-tenant-slug'
import { validateSlugFormat } from '@/lib/utils/reserved-slugs'
describe('TC-F35.M40 PW1 domain slug', () => {
    it('preserves the source subdomain, not tenant name or store ID', () => {
        expect(pw1SlugCandidate('https://test-dev-pw10.web.dev.ecommercehub.my', '546')).toBe('test-dev-pw10')
        expect(pw1SlugCandidate('https://www.mybrand.com', '1')).toBe('mybrand')
    })
    it('suffixes occupied and reserved slugs without taking another tenant', async () => {
        expect(await selectPw1TenantSlug('https://amelina.example.com', '205', async s => ['amelina', 'amelina-205'].includes(s))).toBe('amelina-205-2')
        expect(pw1SlugCandidate('https://admin.example.com', '205')).toBe('admin-205')
    })
    it('keeps short/numeric/long labels within tenant validation', () => {
        for (const label of ['ab', '123', 'a'.repeat(63)]) expect(validateSlugFormat(pw1SlugCandidate(`https://${label}.com`, '546', 1))).toBeNull()
    })
})
