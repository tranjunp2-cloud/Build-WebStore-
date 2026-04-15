// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act } from '@testing-library/react'
import React from 'react'

// Mock useSearchParams before import
vi.mock('next/navigation', () => ({
    useSearchParams: vi.fn(() => new URLSearchParams('tab=overview')),
}))

import { DashboardTabContent, TabPanel } from '@/components/dashboard/DashboardTabContent'

beforeEach(() => {
    // Reset history.replaceState mock
    vi.spyOn(window.history, 'replaceState').mockImplementation(() => {})
})

afterEach(() => {
    vi.restoreAllMocks()
})

describe('TabPanel', () => {
    // TC-F03-TAB-01: active tab is visible (no hidden class)
    it('TC-F03-TAB-01: active tab panel is visible', () => {
        render(
            <DashboardTabContent defaultTab="overview">
                <TabPanel tabId="overview">
                    <span data-testid="overview-content">Overview</span>
                </TabPanel>
                <TabPanel tabId="analytics">
                    <span data-testid="analytics-content">Analytics</span>
                </TabPanel>
            </DashboardTabContent>
        )

        const overviewPanel = screen.getByTestId('overview-content').parentElement
        const analyticsPanel = screen.getByTestId('analytics-content').parentElement

        expect(overviewPanel?.className).not.toContain('hidden')
        expect(analyticsPanel?.className).toContain('hidden')
    })

    // TC-F03-TAB-02: inactive tab has hidden class
    it('TC-F03-TAB-02: inactive tab has hidden class', () => {
        render(
            <DashboardTabContent defaultTab="analytics">
                <TabPanel tabId="overview">
                    <span data-testid="overview">Overview</span>
                </TabPanel>
                <TabPanel tabId="analytics">
                    <span data-testid="analytics">Analytics</span>
                </TabPanel>
            </DashboardTabContent>
        )

        expect(screen.getByTestId('overview').parentElement?.className).toContain('hidden')
        expect(screen.getByTestId('analytics').parentElement?.className).not.toContain('hidden')
    })
})

describe('DashboardTabContent popstate', () => {
    // TC-F03-TAB-03: syncs activeTab on popstate event
    it('TC-F03-TAB-03: syncs activeTab on popstate event', () => {
        render(
            <DashboardTabContent defaultTab="overview">
                <TabPanel tabId="overview">
                    <span data-testid="overview">Overview</span>
                </TabPanel>
                <TabPanel tabId="seo">
                    <span data-testid="seo">SEO</span>
                </TabPanel>
            </DashboardTabContent>
        )

        // Initially overview is active
        expect(screen.getByTestId('overview').parentElement?.className).not.toContain('hidden')
        expect(screen.getByTestId('seo').parentElement?.className).toContain('hidden')

        // Simulate popstate with ?tab=seo
        Object.defineProperty(window, 'location', {
            value: { ...window.location, search: '?tab=seo' },
            writable: true,
            configurable: true,
        })

        act(() => {
            window.dispatchEvent(new PopStateEvent('popstate'))
        })

        expect(screen.getByTestId('overview').parentElement?.className).toContain('hidden')
        expect(screen.getByTestId('seo').parentElement?.className).not.toContain('hidden')
    })

    // TC-F03-TAB-04: ignores popstate with invalid tab value
    it('TC-F03-TAB-04: ignores popstate with invalid tab value', () => {
        render(
            <DashboardTabContent defaultTab="overview">
                <TabPanel tabId="overview">
                    <span data-testid="overview">Overview</span>
                </TabPanel>
            </DashboardTabContent>
        )

        Object.defineProperty(window, 'location', {
            value: { ...window.location, search: '?tab=invalid' },
            writable: true,
            configurable: true,
        })

        act(() => {
            window.dispatchEvent(new PopStateEvent('popstate'))
        })

        // Should stay on overview
        expect(screen.getByTestId('overview').parentElement?.className).not.toContain('hidden')
    })
})
