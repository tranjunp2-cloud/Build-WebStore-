// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import SlugPicker from '@/components/onboarding/SlugPicker'

vi.mock('@/i18n', () => ({
    useI18n: () => ({
        t: {
            onboarding: {
                form: {
                    slugLabel: 'Your website address',
                    slugPlaceholder: 'your-store-name',
                    slugMinLength: 'Too short',
                    slugInvalidFormat: 'Invalid',
                    slugReserved: 'Reserved',
                    slugTaken: 'Taken',
                    slugCheckError: 'Error',
                    slugAvailable: 'Available',
                    slugChecking: 'Checking',
                },
            },
        },
    }),
}))

describe('[TC-F26-11-06] SlugPicker international auto-generation', () => {
    it.each([
        ['Русская Пекарня Москва', 'russkaya-pekarnya-moskva'],
        ['Українська Пекарня Київ', 'ukrayinska-pekarnya-kiyiv'],
        ['さくらラーメン', 'sakura-ramen'],
        ['東京ラーメン', 'dong-jing-ramen'],
        ['北京传统餐厅', 'bei-jing-chuan-tong-can-ting'],
    ])('fills the website address for %s', async (businessName, expected) => {
        // Arrange
        render(<SlugPicker businessName={businessName} skipInitialCheck />)

        // Act / Assert
        await waitFor(() => expect(screen.getByRole('textbox')).toHaveValue(expected))
    })

    it.each(['ร้านอาหารไทย', '🏪✨'])(
        'fills a DNS-safe fallback website address for unsupported input %s',
        async (businessName) => {
            // Arrange
            render(<SlugPicker businessName={businessName} skipInitialCheck />)

            // Act / Assert
            await waitFor(() => {
                const input = screen.getByRole('textbox') as HTMLInputElement
                expect(input.value).toMatch(/^site-[a-z0-9]{7}$/)
            })
        },
    )
})
