/**
 * Unit Tests: Decorative Primitives (Wave 2 Phase A4)
 * TC-IDs: TC-F01D-A4.01 → TC-F01D-A4.08
 * Convention: docs/TEST_CONVENTION.md
 * Plan: plans/260417-1345-wave2-visual-diversity/phase-03-A4-visual-diversity.md
 *
 * Each primitive verified for: render, accepts props, renders aria-hidden
 * (decorative-only, must not pollute a11y tree). NoiseTexture also verifies
 * filter ID uniqueness across multiple instances.
 */

import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import {
    MeshGradient,
    NoiseTexture,
    LayeredShapes,
    AsymmetricGrid,
    DuotoneOverlay,
    TypographicMark,
    GridLines,
    DiagonalStripe,
} from '@/blocks/shared/decorative'

describe('TC-F01D-A4.01: MeshGradient', () => {
    it('renders a single positioned div with radial-gradient layers', () => {
        const { container } = render(<MeshGradient color="rgb(99,102,241)" />)
        const div = container.firstElementChild as HTMLElement
        expect(div).toBeTruthy()
        expect(div.className).toContain('absolute')
        expect(div.className).toContain('pointer-events-none')
        expect(div.style.backgroundImage).toContain('radial-gradient')
        expect(div.getAttribute('aria-hidden')).toBe('true')
    })

    it('honors opacity prop', () => {
        const { container } = render(<MeshGradient color="#000" opacity={0.5} />)
        const div = container.firstElementChild as HTMLElement
        expect(div.style.opacity).toBe('0.5')
    })

    it('uses accentColor when provided', () => {
        const { container } = render(<MeshGradient color="red" accentColor="blue" />)
        const div = container.firstElementChild as HTMLElement
        expect(div.style.backgroundImage).toContain('blue')
    })
})

describe('TC-F01D-A4.02: NoiseTexture', () => {
    it('renders SVG with feTurbulence filter', () => {
        const { container } = render(<NoiseTexture />)
        const svg = container.querySelector('svg')
        expect(svg).toBeTruthy()
        expect(svg?.getAttribute('aria-hidden')).toBe('true')
        expect(container.querySelector('feTurbulence')).toBeTruthy()
    })

    it('generates unique filter IDs across instances', () => {
        const { container } = render(
            <>
                <NoiseTexture />
                <NoiseTexture />
            </>,
        )
        const filters = container.querySelectorAll('filter')
        expect(filters.length).toBe(2)
        expect(filters[0].id).not.toBe(filters[1].id)
    })

    it('passes opacity to the rect element', () => {
        const { container } = render(<NoiseTexture opacity={0.2} />)
        const rect = container.querySelector('rect')
        expect(rect?.getAttribute('opacity')).toBe('0.2')
    })
})

describe('TC-F01D-A4.03: LayeredShapes', () => {
    it('renders three child shapes in an aria-hidden wrapper', () => {
        const { container } = render(<LayeredShapes color="orange" />)
        const wrapper = container.firstElementChild as HTMLElement
        expect(wrapper.getAttribute('aria-hidden')).toBe('true')
        expect(wrapper.children.length).toBe(3)
    })

    it('applies opacity scaling to each layer', () => {
        const { container } = render(<LayeredShapes color="purple" opacity={0.5} />)
        const layers = container.firstElementChild!.children
        expect(parseFloat((layers[0] as HTMLElement).style.opacity)).toBeCloseTo(0.6, 2)
        expect(parseFloat((layers[1] as HTMLElement).style.opacity)).toBeCloseTo(0.4, 2)
        expect(parseFloat((layers[2] as HTMLElement).style.opacity)).toBeCloseTo(0.3, 2)
    })
})

describe('TC-F01D-A4.04: AsymmetricGrid', () => {
    it('renders 12 grid cells in aria-hidden wrapper', () => {
        const { container } = render(<AsymmetricGrid color="teal" />)
        const wrapper = container.firstElementChild as HTMLElement
        expect(wrapper.getAttribute('aria-hidden')).toBe('true')
        const grid = wrapper.firstElementChild as HTMLElement
        expect(grid.style.gridTemplateColumns).toBe('1fr 2fr 1fr 3fr')
        expect(grid.children.length).toBe(12)
    })
})

describe('TC-F01D-A4.05: DuotoneOverlay', () => {
    it('renders mix-blend-mode multiply by default', () => {
        const { container } = render(<DuotoneOverlay color1="#ff0000" />)
        const div = container.firstElementChild as HTMLElement
        expect(div.style.mixBlendMode).toBe('multiply')
        expect(div.getAttribute('aria-hidden')).toBe('true')
    })

    it('uses both colors in gradient', () => {
        const { container } = render(<DuotoneOverlay color1="red" color2="blue" />)
        const div = container.firstElementChild as HTMLElement
        expect(div.style.background).toContain('red')
        expect(div.style.background).toContain('blue')
    })

    it('respects custom blendMode', () => {
        const { container } = render(<DuotoneOverlay color1="#000" blendMode="overlay" />)
        const div = container.firstElementChild as HTMLElement
        expect(div.style.mixBlendMode).toBe('overlay')
    })
})

describe('TC-F01D-A4.06: TypographicMark', () => {
    it('renders the text content inside aria-hidden wrapper', () => {
        const { container } = render(<TypographicMark text="01" />)
        const wrapper = container.firstElementChild as HTMLElement
        expect(wrapper.getAttribute('aria-hidden')).toBe('true')
        expect(wrapper.textContent).toBe('01')
    })

    it('applies size class for clamp font-size', () => {
        const { container } = render(<TypographicMark text="A" size="xl" />)
        const span = container.querySelector('span')!
        expect(span.className).toContain('clamp')
    })
})

describe('TC-F01D-A4.07: GridLines', () => {
    it('renders both horizontal and vertical lines by default', () => {
        const { container } = render(<GridLines />)
        const div = container.firstElementChild as HTMLElement
        expect(div.getAttribute('aria-hidden')).toBe('true')
        expect(div.style.backgroundImage).toContain('to right')
        expect(div.style.backgroundImage).toContain('to bottom')
    })

    it('horizontal-only direction omits vertical lines', () => {
        const { container } = render(<GridLines direction="horizontal" />)
        const div = container.firstElementChild as HTMLElement
        expect(div.style.backgroundImage).toContain('to right')
        expect(div.style.backgroundImage).not.toContain('to bottom')
    })

    it('honors spacing prop', () => {
        const { container } = render(<GridLines spacing={60} />)
        const div = container.firstElementChild as HTMLElement
        expect(div.style.backgroundSize).toBe('60px 60px')
    })
})

describe('TC-F01D-A4.08: DiagonalStripe', () => {
    it('renders skewed band in aria-hidden wrapper', () => {
        const { container } = render(<DiagonalStripe color="cyan" />)
        const wrapper = container.firstElementChild as HTMLElement
        expect(wrapper.getAttribute('aria-hidden')).toBe('true')
        const band = wrapper.firstElementChild as HTMLElement
        expect(band.style.transform).toBe('skewY(-6deg)')
    })

    it('respects custom angle', () => {
        const { container } = render(<DiagonalStripe color="magenta" angle={-12} />)
        const band = container.firstElementChild!.firstElementChild as HTMLElement
        expect(band.style.transform).toBe('skewY(-12deg)')
    })
})
