/**
 * TC-PERF-120..124 — the dashboard mascot loads its chat code lazily (components/agent/DashboardAgentDockLoader).
 * TC-PERF-120 the page shows a still mascot button at once; the dock's code is not loaded until the page has loaded
 *             and the browser is idle, then the dock replaces the placeholder.
 * TC-PERF-121 a click on the placeholder opens the chat once the dock has loaded (the request is not lost).
 * TC-PERF-122 an ask bar's request made before the dock loaded reaches it once, with its prompt, in order.
 * TC-PERF-123 a reminder link (?todo=) loads the dock at once.
 * TC-PERF-124 the blog editor (own copilot column) shows neither the placeholder nor the dock.
 * Real: the loader, the placeholder, the open-request queue, next/dynamic. Faked: the dock module (a probe that
 * listens the way DashboardAgentDock does), next/navigation.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import React, { useEffect, useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const nav = vi.hoisted(() => ({ pathname: '/products' }))
vi.mock('next/navigation', () => ({ usePathname: () => nav.pathname }))
const dockModule = vi.hoisted(() => ({ loaded: 0 }))
vi.mock('@/components/agent/DashboardAgentDock', async () => {
    dockModule.loaded += 1
    const queue = await import('@/components/agent/agent-open-queue')
    // listens like DashboardAgentDock's DockSurface: subscribe, then take what was held
    function ProbeDock() {
        const [opened, setOpened] = useState<string[]>([])
        useEffect(() => {
            const onOpen = (e: Event) => setOpened((list) => [...list, String((e as CustomEvent<{ prompt?: string }>).detail?.prompt ?? '(open)')])
            window.addEventListener(queue.AGENT_OPEN_EVENT, onOpen)
            for (const detail of queue.takeHeldAgentOpens()) onOpen(new CustomEvent(queue.AGENT_OPEN_EVENT, { detail }))
            return () => {
                window.removeEventListener(queue.AGENT_OPEN_EVENT, onOpen)
                queue.dockStoppedListening()
            }
        }, [])
        return <div data-testid="dock">{opened.join('|')}</div>
    }
    return { default: ProbeDock }
})

import { DashboardAgentDockLoader } from '@/components/agent/DashboardAgentDockLoader'
import { I18nProvider } from '@/i18n'

const mount = () => render(<I18nProvider defaultLocale="en"><DashboardAgentDockLoader /></I18nProvider>)
const placeholder = () => screen.queryByRole('button', { name: 'Open ECH Agent' })

beforeEach(() => {
    nav.pathname = '/products'
    window.history.replaceState(null, '', '/products')
})
afterEach(() => {
    cleanup()
    vi.useRealTimers()
})

describe('lazy mascot dock [TC-PERF-120..124]', () => {
    it('TC-PERF-120 placeholder first; the dock loads only once the page is loaded and idle', async () => {
        // Arrange
        vi.useFakeTimers()
        const loadedBefore = dockModule.loaded

        // Act
        mount()

        // Assert
        expect(placeholder()).toBeInTheDocument()
        expect(screen.queryByTestId('dock')).toBeNull()
        await act(async () => { await vi.advanceTimersByTimeAsync(150) })
        expect(screen.queryByTestId('dock')).toBeNull()
        await act(async () => { await vi.advanceTimersByTimeAsync(100) }) // idle (no requestIdleCallback: 200 ms)
        vi.useRealTimers()
        expect(await screen.findByTestId('dock')).toBeInTheDocument()
        expect(placeholder()).toBeNull()
        expect(dockModule.loaded - loadedBefore).toBeLessThanOrEqual(1)
    })

    it('TC-PERF-121 a click on the placeholder opens the chat once the dock is there', async () => {
        // Arrange
        mount()

        // Act
        fireEvent.click(placeholder()!)

        // Assert
        await waitFor(() => expect(screen.getByTestId('dock')).toHaveTextContent('(open)'))
    })

    it('TC-PERF-122 requests made before the dock listened arrive once each, in order', async () => {
        // Arrange
        mount()

        // Act
        act(() => {
            window.dispatchEvent(new CustomEvent('ech-agent:open', { detail: { prompt: 'Add 3 shirts' } }))
            window.dispatchEvent(new CustomEvent('ech-agent:open', { detail: { prompt: 'Then price them' } }))
        })

        // Assert
        await waitFor(() => expect(screen.getByTestId('dock')).toHaveTextContent('Add 3 shirts|Then price them'))
        act(() => { window.dispatchEvent(new CustomEvent('ech-agent:open', { detail: { prompt: 'Later' } })) })
        expect(screen.getByTestId('dock')).toHaveTextContent('Add 3 shirts|Then price them|Later')
    })

    it('TC-PERF-123 a reminder link loads the dock at once', async () => {
        // Arrange
        window.history.replaceState(null, '', '/discounts?todo=discounts_expiring')
        vi.useFakeTimers()

        // Act
        mount()
        await act(async () => { await vi.advanceTimersByTimeAsync(0) })
        vi.useRealTimers()

        // Assert
        expect(await screen.findByTestId('dock')).toBeInTheDocument()
    })

    it('TC-PERF-124 nothing on the blog editor', () => {
        // Arrange
        nav.pathname = '/blog/12'

        // Act
        mount()

        // Assert
        expect(placeholder()).toBeNull()
        expect(screen.queryByTestId('dock')).toBeNull()
    })
})
