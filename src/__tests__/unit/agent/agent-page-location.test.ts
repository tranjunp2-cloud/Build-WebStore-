import { describe, expect, it } from 'vitest'
import { dashboardPageLocation, editorPageLocation } from '@/components/agent/agent-page-location'

// TC-AICP-126 — the docks name the screen the merchant is on the way the sidebar does,
// with its address, so "which page am I on" is answered from the screen.

describe('[TC-AICP-126] copilot page location', () => {
    it('names a sidebar page by its section and item', () => {
        // staging's sidebar has no Product Store / Product Master items: its own menu names are used
        expect(dashboardPageLocation('/products', 'store')).toEqual({ title: 'Core Operations › Products', path: '/products', module: 'store' })
        expect(dashboardPageLocation('/settings/shipping', 'settings').title).toBe('Settings › Shipping')
        expect(dashboardPageLocation('/dashboard', 'dashboard').title).toBe('Dashboard')
    })

    it('says a record is open below the menu item, and falls back to the address word', () => {
        expect(dashboardPageLocation('/blog/42?tab=seo', 'blog')).toEqual({ title: 'Online Store › Blog › a record', path: '/blog/42', module: 'blog' })
        expect(dashboardPageLocation('/sites', 'sites').title).toBe('Sites')
    })

    it('names the page open in the site editor', () => {
        expect(editorPageLocation(7, 'Home')).toEqual({ title: 'Online Store › Editor › page "Home"', path: '/editor/7', module: 'editor' })
        expect(editorPageLocation('7', null).title).toBe('Online Store › Editor')
    })
})
