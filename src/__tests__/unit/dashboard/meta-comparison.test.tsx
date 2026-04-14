/**
 * Unit Tests — Before/After Meta Comparison (FR-13, BR-06)
 * Coverage Map (QA Doc Traceability):
 *   TC-F03.13-01 → Renders current + proposed when currentMeta exists
 *   TC-F03.13-02 → Only renders proposed when no currentMeta
 *   TC-F03.13-03 → Lookup from seoData.pages by targetId works correctly
 */

import { describe, it, expect } from 'vitest'

// ── Test the lookup logic used in seo/page.tsx for before/after comparison ──

type PageAnalysis = {
    pageId: string | number
    title: string
    slug: string
    score: number
    issues: any[]
    currentMetaTitle?: string
    currentMetaDescription?: string
}

type ProposedFix = {
    id: string
    targetId: string
    collection: 'pages' | 'products'
    name: string
    proposedTitle?: string
    proposedDescription?: string
}

describe('Before/After Meta Comparison [TC-F03.13-01..03]', () => {
    const seoPages: PageAnalysis[] = [
        {
            pageId: '10',
            title: 'About Us',
            slug: 'about-us',
            score: 40,
            issues: [],
            currentMetaTitle: 'Old About Title',
            currentMetaDescription: 'Old about description here.',
        },
        {
            pageId: '20',
            title: 'Contact',
            slug: 'contact',
            score: 30,
            issues: [],
            // No current meta — new page
        },
    ]

    it('[TC-F03.13-01] finds currentMeta when page has existing meta', () => {
        // Arrange
        const fix: ProposedFix = {
            id: '1',
            targetId: '10',
            collection: 'pages',
            name: 'About Us',
            proposedTitle: 'New About Title | MySite',
            proposedDescription: 'New about description.',
        }

        // Act — replicate the lookup from seo/page.tsx modal
        const currentTitle = seoPages.find(p => String(p.pageId) === fix.targetId)?.currentMetaTitle
        const currentDesc = seoPages.find(p => String(p.pageId) === fix.targetId)?.currentMetaDescription

        // Assert
        expect(currentTitle).toBe('Old About Title')
        expect(currentDesc).toBe('Old about description here.')
    })

    it('[TC-F03.13-02] returns undefined when page has no existing meta', () => {
        // Arrange
        const fix: ProposedFix = {
            id: '2',
            targetId: '20',
            collection: 'pages',
            name: 'Contact',
            proposedTitle: 'Contact Us | MySite',
        }

        // Act
        const currentTitle = seoPages.find(p => String(p.pageId) === fix.targetId)?.currentMetaTitle
        const currentDesc = seoPages.find(p => String(p.pageId) === fix.targetId)?.currentMetaDescription

        // Assert
        expect(currentTitle).toBeUndefined()
        expect(currentDesc).toBeUndefined()
    })

    it('[TC-F03.13-03] handles non-matching targetId gracefully', () => {
        // Arrange
        const fix: ProposedFix = {
            id: '3',
            targetId: '999',
            collection: 'pages',
            name: 'Missing Page',
            proposedTitle: 'Some Title',
        }

        // Act
        const page = seoPages.find(p => String(p.pageId) === fix.targetId)

        // Assert — undefined, not a crash
        expect(page).toBeUndefined()
    })
})
