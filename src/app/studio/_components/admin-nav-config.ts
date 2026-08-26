/**
 * Studio Admin Navigation Configuration
 * 6 sections, 19 items. phase=null means "Roadmap" (no ETA).
 * badge: visible count string. liveDot: real-time activity indicator.
 */

export type NavItem = {
    href: string
    label: string
    /** Which phase implements this route. null = roadmap/no phase ETA. */
    phase: number | null
    badge?: string
    liveDot?: boolean
}

export type NavSection = {
    title: string
    items: NavItem[]
}

export const NAV_SECTIONS: NavSection[] = [
    {
        title: 'Workspace',
        items: [
            { href: '/studio', label: 'Dashboard', phase: 1 },
            { href: '/studio/analytics', label: 'Analytics', phase: null },
        ],
    },
    {
        title: 'Templates',
        items: [
            { href: '/studio/templates', label: 'All templates', phase: 2, badge: '48' },
            { href: '/studio/drafts', label: 'Drafts', phase: 2, badge: '5' },
            { href: '/studio/review', label: 'Review workflow', phase: 8, badge: '2' },
            { href: '/studio/versions', label: 'Versions', phase: 9 },
            { href: '/studio/scheduled', label: 'Scheduled', phase: 2, badge: '1' },
            { href: '/studio/archived', label: 'Archived', phase: 2 },
        ],
    },
    {
        title: 'Intelligence',
        items: [
            { href: '/studio/blocks', label: 'Block usage', phase: 4 },
            { href: '/studio/packs', label: 'Content packs', phase: 8 },
            { href: '/studio/performance', label: 'AI quality', phase: 7 },
        ],
    },
    {
        title: 'Monitoring',
        items: [
            { href: '/studio/generations', label: 'User generations', phase: 5, liveDot: true },
            { href: '/studio/issues', label: 'Issues & feedback', phase: 6, badge: '8' },
            { href: '/studio/qa', label: 'QA Control Center', phase: 8 },
            { href: '/studio/qa/visual-review', label: 'Visual CMS Review', phase: 8, badge: 'NEW' },
        ],
    },
    {
        title: 'Organize',
        items: [
            { href: '/studio/categories', label: 'Categories', phase: 8 },
            { href: '/studio/tags', label: 'Tags & AI prompts', phase: 8 },
        ],
    },
    {
        title: 'Admin',
        items: [
            { href: '/studio/settings', label: 'Settings', phase: null },
        ],
    },
]
