import { describe, it, expect } from 'vitest'
import { getBlockDisplayName } from '@/components/editor/block-display-name'

describe('getBlockDisplayName [TC-F05-RT-03, TC-F05-RT-04]', () => {
    it('shows custom-html as "Rich text"', () => {
        expect(getBlockDisplayName('custom-html')).toBe('Rich text')
    })

    it('replaces dashes for other block types', () => {
        expect(getBlockDisplayName('hero-banner')).toBe('hero banner')
        expect(getBlockDisplayName('hero')).toBe('hero')
    })
})
