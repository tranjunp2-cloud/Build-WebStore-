import { createHash } from 'node:crypto'
import { NavigationConfigSchema } from '@/blocks/navigation/config'
import { FooterConfigSchema } from '@/blocks/footer/config'

const DIRECTIONS = [
    { name: 'editorial', document: 'reading', mood: 'Editorial hierarchy, spacious brand presentation, asymmetric hero.', navigation: 'centered', footer: 'centered-stack', hero: 'split-left', products: 'grid-3', articles: 'list' },
    { name: 'catalog', document: 'wide', mood: 'Product-focused catalog with clear discovery and structured navigation.', navigation: 'mega', footer: 'dark-gradient', hero: 'split-right', products: 'grid-4', articles: 'cards' },
    { name: 'immersive', document: 'wide', mood: 'Image-led showcase with a strong first impression and contrasting footer.', navigation: 'transparent', footer: 'dark-gradient', hero: 'fullscreen', products: 'grid-3', articles: 'cards' },
    { name: 'boutique', document: 'panel', mood: 'Compact boutique identity, floating navigation and generous visual space.', navigation: 'floating', footer: 'centered-stack', hero: 'centered', products: 'grid-3', articles: 'cards' },
    { name: 'studio', document: 'panel', mood: 'Distinctive studio presentation with side navigation and an asymmetric composition.', navigation: 'sidebar', footer: 'centered-stack', hero: 'split-right', products: 'list', articles: 'list' },
    { name: 'classic', document: 'reading', mood: 'Clear service-oriented presentation with familiar navigation and structured content.', navigation: 'default', footer: 'simple', hero: 'split-left', products: 'grid-4', articles: 'list' },
] as const

/** Stable per-store exploration brief; AI still selects compatible native layouts. */
export function pw1DesignDirection(storeId: string) {
    const index = createHash('sha256').update(`pw1-design-v1:${storeId}`).digest().readUInt32BE(0) % DIRECTIONS.length
    return {
        ...DIRECTIONS[index],
        allowedNavigationVariants: NavigationConfigSchema.shape.variant.removeDefault().options,
        allowedFooterVariants: FooterConfigSchema.shape.variant.removeDefault().options,
    }
}

export function pw1SectionPreference(storeId: string, componentId: string, allowed: string[]): string {
    if (!allowed.length) throw new Error('Section must have a supported layout')
    const index = createHash('sha256').update(`pw1-section-v1:${storeId}:${componentId}`).digest().readUInt32BE(0) % allowed.length
    return allowed[index]
}
