import { describe, expect, it, vi } from 'vitest'

type FontOptions = {
    preload?: boolean
    variable?: string
}

const { fontCalls } = vi.hoisted(() => ({
    fontCalls: [] as Array<{ name: string; options: FontOptions }>,
}))

vi.mock('next/font/google', () => {
    const fontNames = [
        'Inter', 'Outfit', 'Lora', 'Playfair_Display', 'Space_Grotesk', 'Nunito',
        'Nunito_Sans', 'Oswald', 'Source_Sans_3', 'Cormorant_Garamond',
        'Proza_Libre', 'DM_Sans', 'Sora', 'Work_Sans', 'Raleway', 'Poppins',
        'Lato', 'Open_Sans', 'Karla', 'Archivo_Black', 'DM_Mono', 'Merriweather',
        'Source_Serif_4', 'Varela_Round', 'Manrope', 'Rajdhani', 'Exo_2',
        'Josefin_Sans', 'Quicksand', 'Montserrat', 'Hind',
    ] as const

    return Object.fromEntries(
        fontNames.map((name) => [
            name,
            (options: FontOptions) => {
                fontCalls.push({ name, options })
                return { variable: options.variable ?? `--font-${name.toLowerCase()}` }
            },
        ]),
    )
})

import { FONT_VARIABLES } from '@/lib/fonts/variables'

describe('[TC-GH1603-PERF-01] Root font preload policy', () => {
    it('preloads only the Inter and Outfit core fonts', () => {
        // Arrange
        const callsByName = new Map(fontCalls.map(({ name, options }) => [name, options]))
        const catalogFonts = fontCalls.filter(({ name }) => name !== 'Inter' && name !== 'Outfit')

        // Act
        const corePreloadValues = [
            callsByName.get('Inter')?.preload,
            callsByName.get('Outfit')?.preload,
        ]

        // Assert
        expect(fontCalls).toHaveLength(31)
        expect(corePreloadValues).toEqual([undefined, undefined])
        expect(catalogFonts).toHaveLength(29)
        expect(catalogFonts.every(({ options }) => options.preload === false)).toBe(true)
        expect(FONT_VARIABLES.split(' ')).toHaveLength(31)
    })
})
