import { describe, expect, it } from 'vitest'
import {
    getBlockStrings,
    getSectionLabels,
    injectBlockStrings,
    injectSectionLabels,
} from '@/lib/ai/block-i18n'
import { resolveLocaleStructuralStrings } from '@/lib/ai/locale-structural-strings'

describe('TC-F01-PAS-09: dynamic structural locale resolver', () => {
    it('resolves a locale populated at runtime without a locale-specific branch', () => {
        // Arrange
        const runtimeLocale = 'runtime-locale'
        injectBlockStrings(runtimeLocale, getBlockStrings('zh'))
        injectSectionLabels(runtimeLocale, getSectionLabels('zh')!)

        // Act
        const result = resolveLocaleStructuralStrings(runtimeLocale)

        // Assert
        expect(result).not.toBeNull()
        expect(result?.navigation.about).toBe('关于我们')
        expect(result?.sections.gallery).toBe('图片展示')
        expect(result?.newsletter.emailPlaceholder).toBe('邮箱')
        expect(result?.blogList.readArticleLabel).toBe('阅读文章')
    })

    it('returns null instead of silently falling back to English before translation', () => {
        // Arrange
        const unresolvedLocale = 'not-translated-yet'

        // Act
        const result = resolveLocaleStructuralStrings(unresolvedLocale)

        // Assert
        expect(result).toBeNull()
    })
})
