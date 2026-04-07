import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'

// Mock i18n before imports
vi.mock('@/i18n', () => ({
    useI18n: vi.fn(() => ({
        locale: 'en',
        t: {
            onboarding: {
                generating: {
                    title: 'Create Website with AI',
                    subtitle: 'Website Generation',
                    startingMessage: 'Starting website creation...',
                    creatingTitle: 'Creating Your Website...',
                    creatingSubtitle: 'AI is analyzing your business and generating the perfect design.',
                    stepAnalyzing: 'Analyzing business information',
                    stepGenerating: 'Generating content & design',
                    stepPreparing: 'Preparing preview',
                    progressLabel: 'Building your website',
                    processing: 'Processing...',
                },
            },
        },
        setLocale: vi.fn(),
        toggleLocale: vi.fn(),
        tp: vi.fn(),
        ti: vi.fn(),
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
        expect(screen.getAllByText(/Taking longer than expected/).length).toBeGreaterThan(0)
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
        expect(screen.queryByText(/Taking longer than expected/)).not.toBeInTheDocument()
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
})
