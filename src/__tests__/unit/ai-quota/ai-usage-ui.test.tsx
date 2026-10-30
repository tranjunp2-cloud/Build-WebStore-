/**
 * TC-AIU-UI-001..008 — shop-facing AI allowance (option A): header chip + popover, chat notice / lock.
 * Real: quota-format, use-ai-usage, ai-usage-text, AiUsageChip, useAiChatQuota, I18nProvider (en).
 * Faked: fetch of GET /api/agent/usage (the platform), the clock for "back at".
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import { I18nProvider } from '@/i18n'
import { aiTone, backAt, batteryIcon, parseAiUsage, picturesLeft, planName, SHOW_AI_LEVEL, type AiUsage } from '@/components/ai-quota/quota-format'
import { AiUsageChip } from '@/components/ai-quota/AiUsageChip'
import { useAiChatQuota } from '@/components/ai-quota/ai-chat-quota'

const usage = (leftPercent: number, extra: Partial<AiUsage> = {}): AiUsage => ({
    ai: { leftPercent, nextFreeAt: '2026-10-27T06:20:00.000Z' },
    pictures: { used: 18, limit: 20, nextFreeAt: null },
    paused: false,
    plan: 'STARTER_TM_USER',
    ...extra,
})

function withApp(ui: ReactNode, client: QueryClient | null = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
    const inner = <I18nProvider defaultLocale="en">{ui}</I18nProvider>
    return render(client ? <QueryClientProvider client={client}>{inner}</QueryClientProvider> : inner)
}

function serve(body: unknown, status = 200) {
    return vi.spyOn(globalThis, 'fetch').mockResolvedValue(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } }))
}

afterEach(() => vi.restoreAllMocks())

describe('quota-format', () => {
    it('TC-AIU-UI-001 parses the usage response and rejects anything else', () => {
        // Arrange + Act
        const parsed = parseAiUsage({ ai: { leftPercent: 72.4, nextFreeAt: null }, pictures: { used: 2, limit: null }, paused: false, plan: 'FREEMIUM' })
        // Assert
        expect(parsed).toEqual({ ai: { leftPercent: 72, nextFreeAt: null }, pictures: { used: 2, limit: null, nextFreeAt: null }, paused: false, plan: 'FREEMIUM' })
        expect(parseAiUsage({ error: 'Unauthorized' })).toBeNull()
        expect(parseAiUsage(null)).toBeNull()
        expect(parseAiUsage({ ai: { leftPercent: 140 }, pictures: { used: -1, limit: 3 } })?.ai.leftPercent).toBe(100)
    })

    it('TC-AIU-UI-002 tone: >20 ok, ≤20 low, 0 or paused out; pictures, icons, plan names', () => {
        expect(aiTone(usage(21))).toBe('ok')
        expect(aiTone(usage(20))).toBe('low')
        expect(aiTone(usage(0))).toBe('out')
        expect(aiTone(usage(80, { paused: true }))).toBe('out')
        expect(picturesLeft(usage(50))).toBe(2)
        expect(picturesLeft(usage(50, { pictures: { used: 5, limit: null, nextFreeAt: null } }))).toBeNull()
        expect([batteryIcon(usage(95)), batteryIcon(usage(50)), batteryIcon(usage(12)), batteryIcon(usage(0))]).toEqual(['battery-full', 'battery-medium', 'battery-low', 'battery-warning'])
        expect([planName('FREEMIUM'), planName('STANDARD_NON_TM_USER'), planName('PROFESSIONAL_TM_USER'), planName('X'), planName(null)]).toEqual(['free', 'standard', 'professional', null, null])
    })

    it('TC-AIU-UI-003 "back at" is a clock time, flagged when it falls on a later day', () => {
        const now = new Date('2026-10-27T10:00:00')
        expect(backAt(new Date('2026-10-27T14:20:00').toISOString(), now, 'en-GB')).toEqual({ time: '14:20', laterDay: false })
        expect(backAt(new Date('2026-10-28T09:15:00').toISOString(), now, 'en-GB')).toEqual({ time: '09:15', laterDay: true })
        expect(backAt(null, now)).toBeNull()
        expect(backAt('nope', now)).toBeNull()
    })
})

describe('AiUsageChip', () => {
    // Radix popover measures its anchor; jsdom has no ResizeObserver
    beforeEach(() => vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} }))
    afterEach(() => vi.unstubAllGlobals())

    it('TC-AIU-UI-004 shows "AI 12%" and the popover: sentence, pictures, plan, upgrade (low)', async () => {
        // Arrange
        serve(usage(12))
        // Act
        withApp(<AiUsageChip />)
        const chip = await screen.findByRole('button', { name: /AI left: 12%/ })
        fireEvent.click(chip)
        // Assert
        expect(chip).toHaveTextContent('AI 12%')
        expect(await screen.findByText(/^Almost out\. More comes back at/)).toBeInTheDocument()
        expect(screen.getByText('2 of 20 left')).toBeInTheDocument()
        expect(screen.getByText('Starter plan')).toBeInTheDocument()
        expect(screen.getByRole('link', { name: 'Upgrade plan' })).toBeInTheDocument()
        expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '12')
    })

    it('TC-AIU-UI-005 hides when usage cannot be read, and outside a QueryProvider never fetches', async () => {
        // Arrange
        const fetchSpy = serve({ error: 'Unauthorized' }, 401)
        // Act
        const { container } = withApp(<AiUsageChip />)
        // Assert
        await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
        await waitFor(() => expect(container).toBeEmptyDOMElement())
        fetchSpy.mockClear()
        const bare = withApp(<AiUsageChip />, null)
        expect(bare.container).toBeEmptyDOMElement()
        expect(fetchSpy).not.toHaveBeenCalled()
    })
})

function ChatProbe({ busy = false, editor = false, showLevel }: { busy?: boolean; editor?: boolean; showLevel?: boolean }) {
    const quota = useAiChatQuota({ busy, editor, showLevel })
    return (
        <div>
            <div data-testid="notice">{quota.notice}</div>
            <p data-testid="locked">{quota.locked?.placeholder ?? 'open'}</p>
            <p data-testid="out">{String(quota.out)}</p>
        </div>
    )
}

describe('useAiChatQuota', () => {
    beforeEach(() => vi.useRealTimers())

    it('TC-AIU-UI-006 nothing when plenty; a line at ≤20 %; chat stays open', async () => {
        // Arrange
        serve(usage(72))
        // Act
        const plenty = withApp(<ChatProbe />)
        // Assert
        await waitFor(() => expect(plenty.getByTestId('locked')).toHaveTextContent('open'))
        expect(plenty.getByTestId('notice')).toBeEmptyDOMElement()
        plenty.unmount()
        vi.restoreAllMocks()
        serve(usage(12))
        const low = withApp(<ChatProbe showLevel />)
        expect(await low.findByText('AI is almost out for today (12%)')).toBeInTheDocument()
        expect(low.getByTestId('locked')).toHaveTextContent('open')
    })

    it('TC-AIU-UI-007 used up: box with when it is back + upgrade, composer locked; editor wording', async () => {
        // Arrange
        serve(usage(0))
        // Act
        const view = withApp(<ChatProbe editor />)
        // Assert
        expect(await view.findByText('AI is out for today')).toBeInTheDocument()
        expect(view.getByText(/You can keep editing by hand, nothing is lost\./)).toBeInTheDocument()
        expect(view.getByRole('link', { name: 'Upgrade plan' })).toBeInTheDocument()
        expect(view.getByTestId('locked').textContent).toMatch(/^Available again at /)
        expect(view.getByTestId('out')).toHaveTextContent('true')
    })

    it('TC-AIU-UI-008 level hidden (default while SHOW_AI_LEVEL is off): no line at ≤20 %, used-up still locks', async () => {
        // Arrange
        expect(SHOW_AI_LEVEL).toBe(false)
        const fetchSpy = serve(usage(12))
        // Act
        const low = withApp(<ChatProbe />)
        // Assert
        await waitFor(() => expect(fetchSpy).toHaveBeenCalled())
        await waitFor(() => expect(low.getByTestId('notice')).toBeEmptyDOMElement())
        expect(low.queryByText('AI is almost out for today (12%)')).not.toBeInTheDocument()
        expect(low.getByTestId('locked')).toHaveTextContent('open')
        low.unmount()
        vi.restoreAllMocks()
        serve(usage(0))
        const out = withApp(<ChatProbe />)
        expect(await out.findByText('AI is out for today')).toBeInTheDocument()
        expect(out.getByTestId('out')).toHaveTextContent('true')
    })
})
