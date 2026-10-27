import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, act } from '@testing-library/react'
import en from '@/i18n/locales/en.json'

// Mock i18n before imports. Plan 260415 — use the real en.json so any new
// keys stay in sync automatically (previously a hand-maintained subset
// went stale when the `elapsed` / `timeoutWarning` / `cancelButton` keys
// were added).
vi.mock('@/i18n', () => ({
    useI18n: vi.fn(() => ({
        locale: 'en',
        t: en,
        setLocale: vi.fn(),
        toggleLocale: vi.fn(),
        tp: vi.fn(),
        ti: (template: string, vars: Record<string, string | number>) =>
            template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? '')),
    })),
}))

// Mock the BuilderStepScreen to simplify rendering
vi.mock('@/components/builder/onboarding/BuilderStepScreen', () => ({
    BuilderStepScreen: ({ leftBody, right }: { leftBody: React.ReactNode; right: React.ReactNode }) => (
        <div data-testid="builder-step-screen">
            <div data-testid="left-body">{leftBody}</div>
            <div data-testid="right-pane">{right}</div>
        </div>
    ),
}))

import BuilderGenerationView from '@/components/builder/BuilderGenerationView'
import type { ThemeConfig } from '@/blocks/types'
import type { BusinessInfo } from '@/store/builderStore'

const info = {
    businessName: 'Cookie House',
    industry: 'fnb',
    products: 'Cookies, cakes',
    shortDescription: 'Handmade bakery',
} as BusinessInfo

const theme = {
    primaryColor: '#112233',
    secondaryColor: '#445566',
    accentColor: '#778899',
    surfaceColor: '#ffffff',
    backgroundColor: '#000000',
    fontHeading: 'Playfair Display',
    fontBody: 'Inter',
} as ThemeConfig

// Beats of the paced animation (see use-generation-timeline): 4 brief rows read 1.4s apart,
// a 2.5s hold, then one section every 2.4s; settle 1.5s, paint 4.5s later, ready 1.6s after that.
const WIREFRAME_AT_MS = 1400 * 4 + 2500
const SECTION_MS = 2400
const SETTLE_MS = 1500
const PAINT_MS = 4500

/** Advance fake timers in small steps so effects scheduled by each beat get to run. */
function tick(ms: number) {
    for (let t = 0; t < ms; t += 100) act(() => { vi.advanceTimersByTime(100) })
}

// ── TC-S4-004: BuilderGenerationView — progress, elapsed, timeout, cancel ──
describe('[TC-S4-004] BuilderGenerationView', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders progress bar with correct percentage', () => {
        // Arrange & Act
        const { container } = render(
            <BuilderGenerationView progress={10} />,
        )

        // Assert — progressbar exposes aria-valuenow and inner fill width
        const progressBar = container.querySelector('[role="progressbar"]')
        expect(progressBar?.getAttribute('aria-valuenow')).toBe('10')
        expect(progressBar?.querySelector('[style*="width"]')?.getAttribute('style')).toContain('10%')
    })

    it('shows elapsed seconds when elapsedSeconds > 0', () => {
        // Act
        render(<BuilderGenerationView progress={50} elapsedSeconds={12} />)

        // Assert
        expect(screen.getAllByText(/12s/).length).toBeGreaterThan(0)
    })

    it('does NOT show elapsed when elapsedSeconds is 0', () => {
        // Act
        render(<BuilderGenerationView progress={50} elapsedSeconds={0} />)

        // Assert
        expect(screen.queryByText(/Elapsed/)).not.toBeInTheDocument()
    })

    it('shows timeout warning when showTimeoutWarning=true', () => {
        // Act
        render(
            <BuilderGenerationView
                progress={80}
                showTimeoutWarning={true}
                onCancel={vi.fn()}
            />,
        )

        // Assert
        expect(screen.getAllByText(/This is taking longer than usual/).length).toBeGreaterThan(0)
    })

    it('does NOT show timeout warning when showTimeoutWarning=false', () => {
        // Act
        render(
            <BuilderGenerationView
                progress={80}
                showTimeoutWarning={false}
                onCancel={vi.fn()}
            />,
        )

        // Assert
        expect(screen.queryByText(/This is taking longer than usual/)).not.toBeInTheDocument()
    })

    it('cancel button calls onCancel when clicked', async () => {
        // Arrange
        const onCancel = vi.fn()

        render(
            <BuilderGenerationView
                progress={80}
                showTimeoutWarning={true}
                onCancel={onCancel}
            />,
        )

        // Act — click the first cancel button found
        const cancelButtons = screen.getAllByRole('button', { name: /cancel/i })
        await fireEvent.click(cancelButtons[0])

        // Assert
        expect(onCancel).toHaveBeenCalledTimes(1)
    })

    it('timeout warning has role="alert" for accessibility', () => {
        // Act
        render(
            <BuilderGenerationView
                progress={80}
                showTimeoutWarning={true}
                onCancel={vi.fn()}
            />,
        )

        // Assert
        const alerts = screen.getAllByRole('alert')
        expect(alerts.length).toBeGreaterThan(0)
    })

    // ── TC-F01-PROG — time-based progress interpolation ──
    // Prevents bar from stalling at an early event (e.g. 20%) during the long
    // silent OpenAI call phase. See plans/260414-1630-phase-08-audit progress bug.
    describe('progress interpolation [TC-F01-PROG]', () => {
        function readBarWidth(container: HTMLElement): number {
            const bar = container.querySelector('[role="progressbar"] [style*="width"]') as HTMLElement | null
            if (!bar) return 0
            const match = bar.getAttribute('style')?.match(/width:\s*([\d.]+)%/)
            return match ? parseFloat(match[1]!) : 0
        }

        it('TC-F01-PROG.01 — advances on time while the event is stuck at 20%, capped at 45% until sections show', () => {
            // At 39s elapsed the asymptotic curve sits around 57%, but the brief beat caps the bar at 45%.
            const { container } = render(
                <BuilderGenerationView progress={20} elapsedSeconds={39} />,
            )
            expect(readBarWidth(container)).toBe(45)
        })

        it('TC-F01-PROG.02 — shows the saving step (95%) only once the paced animation has painted the design', () => {
            vi.useFakeTimers()
            try {
                const { container } = render(
                    <BuilderGenerationView progress={95} elapsedSeconds={10} businessInfo={info} theme={theme} blocks={[{ _id: 'a', blockType: 'hero' }]} />,
                )
                expect(readBarWidth(container)).toBeLessThan(45)
                tick(WIREFRAME_AT_MS + SETTLE_MS + PAINT_MS + 100)
                expect(readBarWidth(container)).toBe(95)
            } finally {
                vi.useRealTimers()
            }
        })

        it('TC-F01-PROG.03 — never exceeds 92% from time-based interpolation alone', () => {
            // Even at a huge elapsed time, the curve caps at 92 so the bar
            // does not fill without a real "done" signal.
            const { container } = render(
                <BuilderGenerationView progress={10} elapsedSeconds={600} />,
            )
            expect(readBarWidth(container)).toBeLessThanOrEqual(92)
        })

        it('TC-F01-PROG.04 — monotonic: later elapsed never regresses the bar', () => {
            const first = render(<BuilderGenerationView progress={20} elapsedSeconds={10} />)
            const firstWidth = readBarWidth(first.container)
            first.unmount()

            const second = render(<BuilderGenerationView progress={20} elapsedSeconds={30} />)
            const secondWidth = readBarWidth(second.container)
            expect(secondWidth).toBeGreaterThan(firstWidth)
        })
    })

    // ── TC-S4-004 — real-stream-driven generating screen ──
    describe('stream-driven stage [TC-S4-004]', () => {
        it('renders exactly one card instance (desktop default)', () => {
            const { container } = render(<BuilderGenerationView progress={30} />)
            expect(container.querySelectorAll('[role="progressbar"]').length).toBe(1)
            expect(screen.getByTestId('right-pane').querySelector('[role="progressbar"]')).toBeTruthy()
        })

        it('renders the card inline in the chat column below lg', async () => {
            const original = window.matchMedia
            window.matchMedia = ((q: string) => ({
                matches: false, media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
            })) as unknown as typeof window.matchMedia
            try {
                const { container } = render(<BuilderGenerationView progress={30} />)
                expect(container.querySelectorAll('[role="progressbar"]').length).toBe(1)
                expect(screen.getByTestId('left-body').querySelector('[role="progressbar"]')).toBeTruthy()
            } finally {
                window.matchMedia = original
            }
        })

        it('stepper stays on "Reviewing your business info" until the first block arrives', () => {
            const { container } = render(<BuilderGenerationView progress={65} businessInfo={info} theme={theme} blocks={[]} />)
            expect(container.querySelector('[aria-current="step"]')?.textContent).toContain(en.onboarding.generating.stepAnalyzing)
        })

        it('stepper keeps "Creating content & design" active while sections are revealed', () => {
            vi.useFakeTimers()
            try {
                const { container } = render(<BuilderGenerationView progress={65} businessInfo={info} theme={theme} blocks={[{ _id: 'a', blockType: 'navigation' }]} />)
                expect(container.querySelector('[aria-current="step"]')?.textContent).toContain(en.onboarding.generating.stepAnalyzing)
                tick(WIREFRAME_AT_MS + 100)
                expect(container.querySelector('[aria-current="step"]')?.textContent).toContain(en.onboarding.generating.stepGenerating)
                expect(container.querySelectorAll('li[data-state="done"]').length).toBe(1)
            } finally {
                vi.useRealTimers()
            }
        })

        it('stepper marks "Preparing preview" active with earlier steps done once the design is painted', () => {
            vi.useFakeTimers()
            try {
                const { container } = render(<BuilderGenerationView progress={95} />)
                tick(SETTLE_MS + PAINT_MS + 100)
                expect(container.querySelector('[aria-current="step"]')?.textContent).toContain(en.onboarding.generating.stepPreparing)
                expect(container.querySelectorAll('li[data-state="done"]').length).toBe(2)
                const fills = Array.from(container.querySelectorAll('[data-testid="stepper-fill"]')).map((e) => (e as HTMLElement).style.width)
                expect(fills).toEqual(['100%', '100%'])
            } finally {
                vi.useRealTimers()
            }
        })

        it('fills the second connector by revealed sections (out of 6 planned) while generating', () => {
            vi.useFakeTimers()
            try {
                const blocks = [{ _id: 'a', blockType: 'navigation' }, { _id: 'b', blockType: 'hero' }, { _id: 'c', blockType: 'features' }]
                const { container } = render(<BuilderGenerationView progress={65} businessInfo={info} theme={theme} blocks={blocks} />)
                tick(WIREFRAME_AT_MS + SECTION_MS * 2 + 100)
                const fills = Array.from(container.querySelectorAll('[data-testid="stepper-fill"]')).map((e) => (e as HTMLElement).style.width)
                expect(fills).toEqual(['100%', '50%'])
            } finally {
                vi.useRealTimers()
            }
        })

        it('before theme: scan line, row 0 reading, skeleton insights, no ready pill', () => {
            const { container } = render(<BuilderGenerationView progress={20} businessInfo={info} theme={null} blocks={[]} />)
            expect(screen.getAllByText('Cookie House').length).toBeGreaterThan(0)
            expect(screen.getByTestId('scan-line')).toBeInTheDocument()
            expect(container.querySelector('[data-state="reading"]')).toBeTruthy()
            expect(container.querySelector('[data-state="read"]')).toBeNull()
            expect(screen.getByTestId('insight-palette').getAttribute('data-ready')).toBe('false')
            expect(container.querySelector('[data-testid="insight-palette"] [style*="background-color"]')).toBeNull()
            expect(screen.getByTestId('preview-ready').getAttribute('aria-hidden')).toBe('true')
        })

        it('brief rows are read sequentially on a timer but the last row never completes without a theme', () => {
            vi.useFakeTimers()
            try {
                const { container } = render(<BuilderGenerationView progress={20} businessInfo={info} theme={null} blocks={[]} />)
                tick(1400 * 10)
                expect(container.querySelectorAll('[data-state="read"]').length).toBe(3)
                expect(container.querySelectorAll('[data-state="reading"]').length).toBe(1)
            } finally {
                vi.useRealTimers()
            }
        })

        it('on theme_set: rows finish reading at the same pace, insights reveal real palette + heading font, scan stops', () => {
            vi.useFakeTimers()
            try {
                const { container } = render(<BuilderGenerationView progress={30} businessInfo={info} theme={theme} blocks={[]} />)
                tick(1400 * 4 + 100)
                expect(container.querySelectorAll('[data-state="read"]').length).toBe(4)
            expect(screen.queryByTestId('scan-line')).toBeNull()
            expect(screen.getByTestId('insight-palette').getAttribute('data-ready')).toBe('true')
            expect(container.querySelectorAll('[data-testid="insight-palette"] [style*="background-color"]').length).toBe(5)
            expect(screen.getByText(/Playfair Display \+ Inter/)).toBeInTheDocument()
                expect(screen.getByText('Planning your page sections', { selector: '[data-caption]' })).toBeInTheDocument()
            } finally {
                vi.useRealTimers()
            }
        })

        it('reveals one wireframe section per block on a pace, newest highlighted, brief layer fades out', () => {
            vi.useFakeTimers()
            try {
                const blocks = [{ _id: 'a', blockType: 'navigation' }, { _id: 'b', blockType: 'hero' }]
                const { container } = render(<BuilderGenerationView progress={40} businessInfo={info} theme={theme} blocks={blocks} />)
                expect(container.querySelectorAll('[data-block-type]').length).toBe(0)
                tick(WIREFRAME_AT_MS + 100)
                expect(container.querySelectorAll('[data-block-type]').length).toBe(1)
                tick(SECTION_MS)
                expect(container.querySelectorAll('[data-block-type]').length).toBe(2)
            expect(container.querySelectorAll('[data-newest="true"][data-block-type="hero"]').length).toBe(1)
            expect(container.querySelector('[data-layer="brief"]')?.className).toContain('opacity-0')
            expect(container.querySelector('[data-layer="wireframe"]')?.className).toContain('opacity-100')
                expect(screen.getByText('Writing content for Cookie House', { selector: '[data-caption]' })).toBeInTheDocument()
            } finally {
                vi.useRealTimers()
            }
        })

        it('types the business name into the hero headline with a caret, then completes', () => {
            vi.useFakeTimers()
            try {
                render(<BuilderGenerationView progress={95} businessInfo={info} theme={theme} blocks={[{ _id: 'b', blockType: 'hero' }]} />)
                // Typing starts once every section is shown and the stream has reached its saving step.
                tick(WIREFRAME_AT_MS + SETTLE_MS + 300)
                const partial = screen.getByTestId('hero-headline').textContent ?? ''
                expect(partial.length).toBeGreaterThan(0)
                expect('Cookie House'.startsWith(partial) && partial !== 'Cookie House').toBe(true)
                expect(screen.getByTestId('caret')).toBeInTheDocument()
                act(() => { vi.advanceTimersByTime(55 * 20) })
                expect(screen.getByTestId('hero-headline').textContent).toBe('Cookie House')
                expect(screen.queryByTestId('caret')).toBeNull()
            } finally {
                vi.useRealTimers()
            }
        })

        it('at >=95 after the sections are shown: paints with sweep, then shows Preview ready + shine on the preview layer', () => {
            vi.useFakeTimers()
            try {
                const { container } = render(<BuilderGenerationView progress={95} businessInfo={info} theme={theme} blocks={[{ _id: 'a', blockType: 'hero' }]} />)
                expect(screen.queryByTestId('paint-sweep')).toBeNull()
                tick(WIREFRAME_AT_MS + SETTLE_MS + PAINT_MS + 100)
                expect(screen.getByTestId('paint-sweep')).toBeInTheDocument()
                expect(screen.getByTestId('preview-ready').getAttribute('aria-hidden')).toBe('true')
                tick(1700)
                expect(screen.getByTestId('preview-ready').getAttribute('aria-hidden')).toBe('false')
                expect(screen.getByTestId('shine-sweep')).toBeInTheDocument()
                expect(screen.getByTestId('phone-frame')).toBeInTheDocument()
                expect(container.querySelector('[data-layer="preview"]')?.className).toContain('opacity-100')
                expect(container.querySelector('iframe')).toBeNull()
            } finally {
                vi.useRealTimers()
            }
        })

        it('skips sweeps and typing delay under prefers-reduced-motion', () => {
            const original = window.matchMedia
            window.matchMedia = ((q: string) => ({
                matches: q.includes('prefers-reduced-motion') || q.includes('min-width'),
                media: q, addEventListener: vi.fn(), removeEventListener: vi.fn(),
            })) as unknown as typeof window.matchMedia
            try {
                render(<BuilderGenerationView progress={95} businessInfo={info} theme={theme} blocks={[{ _id: 'a', blockType: 'hero' }]} />)
                expect(screen.queryByTestId('paint-sweep')).toBeNull()
                expect(screen.getByTestId('hero-headline').textContent).toBe('Cookie House')
            } finally {
                window.matchMedia = original
            }
        })
    })
})
