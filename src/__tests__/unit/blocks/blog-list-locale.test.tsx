import React from 'react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

vi.mock('next/image', () => ({
    default: ({ alt }: { alt: string }) => <span>{alt}</span>,
}))

vi.mock('@/blocks/_shared/smart-link', () => ({
    SmartLink: ({ children, href }: { children: React.ReactNode; href: string }) => (
        <a href={href}>{children}</a>
    ),
}))

vi.mock('@/blocks/shared/animations', () => ({
    AnimatedSection: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
    StaggerGrid: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    StaggerItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
    HoverCard: ({ children }: { children: React.ReactNode }) => <article>{children}</article>,
}))

vi.mock('@/blocks/shared/decorative', () => ({
    SectionLabel: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
    GradientBlob: () => null,
}))

vi.mock('@/blocks/shared/RichText', () => ({
    RichText: ({ text }: { text: string }) => <>{text}</>,
}))

vi.mock('@/blocks/shared/Typography', () => ({
    Heading: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
    Body: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}))

vi.mock('@/blocks/shared/SectionWrapper', () => ({
    SectionWrapper: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { BlogListBlock } from '@/blocks/blog-list'
import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'

describe('BlogListBlock locale rendering', () => {
    afterEach(() => {
        vi.unstubAllGlobals()
    })

    it.each([
        ['cards', 'en', '   ', en.storefront.blog.noPosts],
        ['list', 'ms-MY', '', ms.storefront.blog.noPosts],
        ['cards', 'fr', 'Aucun article.', 'Aucun article.'],
    ])('[TC-F35.M20] renders %s empty state for %s without an app locale provider', async (variant, locale, label, expected) => {
        // Arrange
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ docs: [] }) }))
        const props = {
            block: { blockType: 'blog-list', variant, headline: 'News', emptyStateLabel: label },
            theme: { colorMode: 'light' },
            site: { tenant: 7, generationLocale: locale },
        } as unknown as React.ComponentProps<typeof BlogListBlock>
        // Act
        render(<BlogListBlock {...props} />)
        // Assert
        expect(await screen.findByRole('status')).toHaveTextContent(expected)
    })

    it('renders persisted French labels and formats dates with the site locale', async () => {
        const publishedAt = '2026-07-23T12:00:00.000Z'
        vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
            ok: true,
            json: async () => ({
                data: [{
                    id: 1,
                    title: 'Prendre soin de sa peau',
                    content: '<p>Des conseils adaptés à votre peau.</p>',
                    publishedAt,
                    category: null,
                    thumbnail: null,
                    slug: 'prendre-soin-de-sa-peau',
                }],
            }),
        }))

        const props = {
            block: {
                blockType: 'blog-list',
                headline: 'Conseils beauté',
                variant: 'cards',
                limit: 3,
                readArticleLabel: 'Lire l’article',
                uncategorizedLabel: 'Sans catégorie',
                emptyStateLabel: 'Aucun article publié pour le moment.',
            },
            theme: { colorMode: 'light' },
            site: { tenant: 7, generationLocale: 'fr' },
        } as unknown as React.ComponentProps<typeof BlogListBlock>

        render(<BlogListBlock {...props} />)

        expect(await screen.findByText('Prendre soin de sa peau')).toBeInTheDocument()
        expect(screen.getByText('Sans catégorie')).toBeInTheDocument()
        expect(screen.getByText('Lire l’article')).toBeInTheDocument()
        expect(screen.getByText(new Date(publishedAt).toLocaleDateString('fr', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        }))).toBeInTheDocument()
        expect(screen.queryByText('Read Article')).not.toBeInTheDocument()
        expect(screen.queryByText('Uncategorized')).not.toBeInTheDocument()
    })
})

it.each([['en', 'Read more'], ['ms-MY', 'Baca lagi']])('[TC-F35.M57] supplies empty CTA label in store locale %s', async (locale, expected) => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ docs: [{ id: 1, title: 'News', slug: 'news', content: 'Body' }] }) }))
    const props = { block: { blockType: 'blog-list', variant: 'cards', readArticleLabel: ' ' }, theme: {}, site: { tenant: 7, generationLocale: locale } } as unknown as React.ComponentProps<typeof BlogListBlock>
    try {
        // Act
        render(<BlogListBlock {...props} />)
        // Assert
        expect(await screen.findByText(expected)).toBeInTheDocument()
    } finally {
        vi.unstubAllGlobals()
    }
})
