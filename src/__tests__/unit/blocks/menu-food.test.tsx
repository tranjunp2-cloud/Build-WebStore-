import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render } from '@testing-library/react'
import type { BlockProps } from '@/blocks/types'
import type { MenuFoodConfig } from '@/blocks/menu-food/config'
import { MenuFoodBlock } from '@/blocks/menu-food'

// ── TC-TF-022: MenuFoodBlock — null render for empty categories (GH-1219) ────

vi.mock('framer-motion', () => {
    const createPrimitive = (tag: keyof JSX.IntrinsicElements) => {
        const Component = React.forwardRef(({ children, ...props }: React.HTMLAttributes<HTMLElement>, ref: React.Ref<HTMLElement>) =>
            React.createElement(tag, { ...props, ref }, children))
        Component.displayName = `Motion${tag}`
        return Component
    }
    return {
        motion: {
            div: createPrimitive('div'),
            section: createPrimitive('section'),
        },
        useReducedMotion: () => false,
        useInView: () => true,
        AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    }
})

vi.mock('next/image', () => ({
    default: ({ src, alt, fill: _fill, ...props }: { src: string; alt: string; fill?: boolean; [k: string]: unknown }) =>
        React.createElement('img', { src, alt, ...props }),
}))

const themeStub = {
    primaryColor: '#0ea5e9',
    secondaryColor: '#d946ef',
    accentColor: '#f59e0b',
    surfaceColor: '#fff',
    textColor: '#09090b',
    mutedColor: '#71717a',
    fontPairingId: null,
    fontHeading: 'Inter',
    fontBody: 'Inter',
    spacingPreset: 'default' as const,
    borderRadius: 'rounded' as const,
    shadowPreset: 'subtle' as const,
    colorMode: 'light' as const,
    backgroundColor: '#fff',
}

describe('MenuFoodBlock [TC-TF-022]', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    // ── TC-TF-022: empty categories → null render ────────────────────────────
    it('TC-TF-022: returns null when categories is empty — no blank section on page', () => {
        // Arrange
        const block: MenuFoodConfig = {
            blockType: 'menu-food',
            headline: 'Our Menu',
            categories: [],
            variant: 'classic',
        }
        const props: BlockProps<MenuFoodConfig> = { block, theme: themeStub }

        // Act
        const { container } = render(<MenuFoodBlock {...props} />)

        // Assert — component returns null, no DOM nodes rendered
        expect(container.firstChild).toBeNull()
    })

    // ── TC-TF-022b: non-empty categories → renders headline ─────────────────
    it('TC-TF-022b: renders headline when categories are provided', () => {
        // Arrange
        const block: MenuFoodConfig = {
            blockType: 'menu-food',
            headline: 'Our Menu',
            variant: 'classic',
            categories: [
                {
                    name: 'Starters',
                    items: [
                        { name: 'Spring Rolls', description: 'Crispy', price: '12.90', currency: 'RM' },
                        { name: 'Tom Yum', description: 'Spicy broth', price: '18.00', currency: 'RM' },
                        { name: 'Satay', description: 'Grilled chicken', price: '22.00', currency: 'RM' },
                    ],
                },
            ],
        }
        const props: BlockProps<MenuFoodConfig> = { block, theme: themeStub }

        // Act
        const { container } = render(<MenuFoodBlock {...props} />)

        // Assert — DOM has content
        expect(container.firstChild).not.toBeNull()
    })
})
