import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
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

// ── TC-S4-004: BuilderGenerationView — progress, elapsed, timeout, cancel ──
describe('[TC-S4-004] BuilderGenerationView', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    it('renders progress bar with correct percentage', () => {
        // Arrange & Act
        const { container } = render(
            <BuilderGenerationView progress={65} />,
        )

        // Assert — progress bar div has style width matching progress
        const progressBar = container.querySelector('[style*="width"]')
        expect(progressBar).toBeTruthy()
        expect(progressBar?.getAttribute('style')).toContain('65%')
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
            const bar = container.querySelector('[style*="width"]') as HTMLElement | null
            if (!bar) return 0
            const match = bar.getAttribute('style')?.match(/width:\s*([\d.]+)%/)
            return match ? parseFloat(match[1]!) : 0
        }

        it('TC-F01-PROG.01 — stalls bar at least 55% when event stuck at 20% and elapsed=39s', () => {
            // At 39s elapsed the asymptotic curve sits around 57-58%,
            // so the bar must advance well past the 20% event snapshot.
            const { container } = render(
                <BuilderGenerationView progress={20} elapsedSeconds={39} />,
            )
            const width = readBarWidth(container)
            expect(width).toBeGreaterThanOrEqual(55)
            expect(width).toBeLessThanOrEqual(65)
        })

        it('TC-F01-PROG.02 — honours high event progress (>=92) verbatim', () => {
            // Once a late SSE step fires (parsing/saving), we trust it completely.
            const { container } = render(
                <BuilderGenerationView progress={95} elapsedSeconds={10} />,
            )
            expect(readBarWidth(container)).toBe(95)
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
})
