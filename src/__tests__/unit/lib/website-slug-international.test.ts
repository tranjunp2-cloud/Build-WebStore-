import { describe, expect, it } from 'vitest'
import { slugify } from '@/lib/utils/slugify'
import { validateSlugFormat } from '@/lib/utils/reserved-slugs'

describe('[TC-F26-11-06] international website address generation', () => {
    it.each([
        ['Русская Пекарня Москва', 'russkaya-pekarnya-moskva'],
        ['Українська Пекарня Київ', 'ukrayinska-pekarnya-kiyiv'],
        ['اردو بیکری لاہور', 'ardw-bykry-lawr'],
        ['Tiệm Bánh Hoa Mai', 'tiem-banh-hoa-mai'],
        ['さくらラーメン', 'sakura-ramen'],
        ['北京传统餐厅', 'bei-jing-chuan-tong-can-ting'],
    ])('transliterates %s to %s', (businessName, expected) => {
        // Act
        const result = slugify(businessName)

        // Assert
        expect(result).toBe(expected)
        expect(validateSlugFormat(result)).toBeNull()
    })

    it.each(['ร้านอาหารไทย', '🏪✨']) (
        'creates a stable DNS-safe fallback for %s',
        (businessName) => {
            // Act
            const first = slugify(businessName)
            const second = slugify(businessName)

            // Assert
            expect(first).toBe(second)
            expect(first).toMatch(/^site-[a-z0-9]{7}$/)
            expect(validateSlugFormat(first)).toBeNull()
        },
    )
})
