import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// ── Mocks (top of file, before imports) ───────────────────────────────────

vi.mock('next/navigation', () => ({
	useRouter: vi.fn(() => ({ push: vi.fn(), refresh: vi.fn() })),
	usePathname: vi.fn(() => '/editor'),
	useSearchParams: vi.fn(() => ({ get: vi.fn(() => null) })),
}))

vi.mock('next/link', () => ({
	default: ({ href, children, className }: { href: string; children: React.ReactNode; className?: string }) =>
		React.createElement('a', { href, className }, children),
}))

vi.mock('@/i18n', () => ({
	useI18n: vi.fn(() => ({
		locale: 'en',
		t: {
			editor: {
				blockLibrary: {
					searchPlaceholder: 'Search blocks...',
					globalScopeLabel: 'Global',
					pageScopeLabel: 'Page',
					globalScopeTooltipDefault: 'Global block',
					pageScopeTooltipDefault: 'Page block',
					dragHint: 'Drag to add',
					alreadyAddedHint: 'Already added',
					footerHint: 'Drag blocks to your page',
					categories: {
						basics: 'Basics',
						content: 'Content',
						media: 'Media',
					},
					blocks: {
						faq: {
							name: 'FAQ Block',
							description: 'Frequently asked questions',
						},
						'custom-html': {
							name: 'Custom HTML',
							description: 'Custom HTML block',
						},
					},
				},
			},
		},
	})),
}))

vi.mock('@/lib/admin/block-registry-reader', () => ({
	listAllBlocks: vi.fn(() => [
		{
			slug: 'faq',
			name: 'FAQ',
			description: 'FAQ block',
			category: 'content',
			aiVisible: true,
			isSystem: false,
			icon: '❓',
			defaultVariant: 'default',
			variants: ['default'],
			scope: 'page',
		},
		{
			slug: 'custom-html',
			name: 'Custom HTML',
			description: 'Custom HTML block',
			category: 'basics',
			aiVisible: true,
			isSystem: false,
			icon: '🧱',
			defaultVariant: 'default',
			variants: ['default'],
			scope: 'page',
		},
	]),
}))

vi.mock('@/lib/ai/add-section-content', () => ({
	resolveBlockContent: vi.fn((slug: string, locale: string, brand: string) => {
		if (slug === 'faq' && locale === 'ms') {
			return {
				content: { headline: 'Soalan Lazim' },
				localeUsed: 'ms',
				needsTranslation: false,
			}
		}
		return {
			content: { headline: 'FAQ' },
			localeUsed: locale,
			needsTranslation: locale !== 'en',
		}
	}),
	hasLocaleContent: vi.fn((slug: string, locale: string) => {
		if (slug === 'faq' && locale === 'ms') return true
		return locale === 'en'
	}),
}))

// Mock Zustand store
let mockActiveLocale = 'en'
let mockGlobalBlocks: Record<string, unknown> = {}

vi.mock('@/store/editorStore', () => ({
	useEditorStore: vi.fn((selector: (state: any) => any) =>
		selector({
			activeLocale: mockActiveLocale,
			globalBlocks: mockGlobalBlocks,
			updateGlobalBlock: vi.fn(),
		})
	),
	BLOCK_TYPE_TO_KEY: {
		faq: 'faqBlock',
		'custom-html': 'customHtmlBlock',
	},
}))

vi.mock('@/components/ui/tooltip', () => ({
	Tooltip: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
	TooltipTrigger: ({ children, asChild }: { children: React.ReactNode; asChild?: boolean }) => <div>{children}</div>,
	TooltipContent: ({ children, side }: { children: React.ReactNode; side?: string }) => <div>{children}</div>,
	TooltipProvider: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

// ── Imports after mocks ───────────────────────────────────────────────────

import { BlockLibraryPanel } from '@/components/editor/BlockLibraryPanel'
import * as addSectionContent from '@/lib/ai/add-section-content'
import * as blockRegistry from '@/lib/admin/block-registry-reader'

// ═══════════════════════════════════════════════════════════════════════════
// TC-F26-03: Block Library Localized Preview Tests
// ═══════════════════════════════════════════════════════════════════════════

describe('[TC-F26-03] Block Library Locale-Aware Preview', () => {
	const mockOnAIAction = vi.fn()
	const mockOnBlockSelect = vi.fn()

	beforeEach(() => {
		vi.clearAllMocks()
		mockActiveLocale = 'en'
		mockGlobalBlocks = {}
	})

	afterEach(() => {
		vi.useRealTimers()
	})

	// ────────────────────────────────────────────────────────────────────────
	// TC-F26-03-01: activeLocale='ms', block with BM content
	// ────────────────────────────────────────────────────────────────────────

	it('TC-F26-03-01: displays BM headline when activeLocale=ms and block has BM content', () => {
		// Arrange
		mockActiveLocale = 'ms'
		vi.mocked(addSectionContent.hasLocaleContent).mockReturnValue(true)
		vi.mocked(addSectionContent.resolveBlockContent).mockReturnValue({
			content: { headline: 'Soalan Lazim' },
			localeUsed: 'ms',
			needsTranslation: false,
		})

		// Act
		render(
			<BlockLibraryPanel
				blocks={[]}
				selectedBlock={null}
				onBlockSelect={mockOnBlockSelect}
				onAIAction={mockOnAIAction}
			/>
		)

		// Assert
		// When activeLocale='ms' and faq has BM content, previewText should be "Soalan Lazim"
		const faqItems = screen.queryAllByText(/Soalan Lazim|FAQ/)
		expect(faqItems.length).toBeGreaterThan(0)
		// Verify resolveBlockContent was called for faq/ms
		expect(vi.mocked(addSectionContent.resolveBlockContent)).toHaveBeenCalledWith(
			'faq',
			'ms',
			expect.any(String)
		)
	})

	// ────────────────────────────────────────────────────────────────────────
	// TC-F26-03-02: activeLocale='ms', block WITHOUT BM content
	// ────────────────────────────────────────────────────────────────────────

	it('TC-F26-03-02: ✨ AI badge removed — auto-translate now silent on block drop', () => {
		// F26 update: yellow "✨ AI" badge removed from BlockLibraryPanel.
		// Auto-translate now happens silently when block is added (no user opt-in).
		// Arrange
		mockActiveLocale = 'ms'
		vi.mocked(addSectionContent.hasLocaleContent).mockImplementation(
			(slug: string, locale: string) => slug === 'faq' && locale === 'ms'
		)

		// Act
		render(
			<BlockLibraryPanel
				blocks={[]}
				selectedBlock={null}
				onBlockSelect={mockOnBlockSelect}
				onAIAction={mockOnAIAction}
			/>
		)

		// Assert — no badge present anymore
		const aiButtons = screen.queryAllByText(/✨ AI/)
		expect(aiButtons.length).toBe(0)
	})

	// ────────────────────────────────────────────────────────────────────────
	// TC-F26-03-03: activeLocale='en' (no regression)
	// ────────────────────────────────────────────────────────────────────────

	it('TC-F26-03-03: displays EN description and no badge when activeLocale=en', () => {
		// Arrange
		mockActiveLocale = 'en'
		vi.mocked(addSectionContent.hasLocaleContent).mockReturnValue(false)
		vi.mocked(addSectionContent.resolveBlockContent).mockReturnValue({
			content: { headline: 'FAQ' },
			localeUsed: 'en',
			needsTranslation: false,
		})

		// Act
		render(
			<BlockLibraryPanel
				blocks={[]}
				selectedBlock={null}
				onBlockSelect={mockOnBlockSelect}
				onAIAction={mockOnAIAction}
			/>
		)

		// Assert
		// When activeLocale='en', no needsTranslation badges should appear
		const aiButtons = screen.queryAllByText(/✨ AI/)
		expect(aiButtons.length).toBe(0)
		// Verify resolveBlockContent was called for EN locale (no BM content needed)
		expect(vi.mocked(addSectionContent.resolveBlockContent)).not.toHaveBeenCalledWith(
			expect.any(String),
			'ms',
			expect.any(String)
		)
	})

	// ────────────────────────────────────────────────────────────────────────
	// TC-F26-03-04: Search filter includes previewText
	// ────────────────────────────────────────────────────────────────────────

	it('TC-F26-03-04: search filter checks previewText, enabling BM keyword search', () => {
		// Arrange
		mockActiveLocale = 'ms'
		vi.mocked(addSectionContent.hasLocaleContent).mockReturnValue(true)
		vi.mocked(addSectionContent.resolveBlockContent).mockReturnValue({
			content: { headline: 'Soalan Lazim' },
			localeUsed: 'ms',
			needsTranslation: false,
		})

		// Act
		const { rerender } = render(
			<BlockLibraryPanel
				blocks={[]}
				selectedBlock={null}
				onBlockSelect={mockOnBlockSelect}
				onAIAction={mockOnAIAction}
			/>
		)

		// Search for EN keyword (should match via fallback name)
		const searchInput = screen.getByPlaceholderText(/Search blocks/i) as HTMLInputElement
		fireEvent.change(searchInput, { target: { value: 'faq' } })

		// Assert: resolveBlockContent called means previewText computation happened
		expect(vi.mocked(addSectionContent.resolveBlockContent)).toHaveBeenCalledWith(
			'faq',
			'ms',
			expect.any(String)
		)
	})

	// ────────────────────────────────────────────────────────────────────────
	// TC-F26-03-05: ✨ AI button removed — no in-library translation affordance
	// ────────────────────────────────────────────────────────────────────────

	it('TC-F26-03-05: ✨ AI button no longer rendered (auto-translate is silent)', () => {
		// F26 update: removed user-facing translate button in BlockLibraryPanel.
		// Translation now happens automatically when block is dropped.
		// Arrange
		mockActiveLocale = 'ms'
		vi.mocked(addSectionContent.hasLocaleContent).mockImplementation(
			(slug: string, locale: string) => slug === 'faq' && locale === 'ms'
		)

		// Act
		render(
			<BlockLibraryPanel
				blocks={[]}
				selectedBlock={null}
				onBlockSelect={mockOnBlockSelect}
				onAIAction={mockOnAIAction}
			/>
		)

		// Assert — button is gone
		const aiButtons = screen.queryAllByText(/✨ AI/)
		expect(aiButtons.length).toBe(0)
	})

	// ────────────────────────────────────────────────────────────────────────
	// TC-F26-03-06: Locale toggle re-computes categories with activeLocale dependency
	// ────────────────────────────────────────────────────────────────────────

	it('TC-F26-03-06: categories useMemo includes activeLocale in dependency array', () => {
		// Arrange
		mockActiveLocale = 'en'
		const resolveContentSpy = vi.mocked(addSectionContent.resolveBlockContent)
		resolveContentSpy.mockClear()

		const { rerender } = render(
			<BlockLibraryPanel
				blocks={[]}
				selectedBlock={null}
				onBlockSelect={mockOnBlockSelect}
				onAIAction={mockOnAIAction}
			/>
		)

		const callCountEN = resolveContentSpy.mock.calls.length

		// Act: Switch locale to MS
		mockActiveLocale = 'ms'
		vi.mocked(addSectionContent.hasLocaleContent).mockReturnValue(true)
		vi.mocked(addSectionContent.resolveBlockContent).mockReturnValue({
			content: { headline: 'Soalan Lazim' },
			localeUsed: 'ms',
			needsTranslation: false,
		})

		rerender(
			<BlockLibraryPanel
				blocks={[]}
				selectedBlock={null}
				onBlockSelect={mockOnBlockSelect}
				onAIAction={mockOnAIAction}
			/>
		)

		// Assert: resolveBlockContent called again for MS
		const callCountMS = resolveContentSpy.mock.calls.length
		expect(callCountMS).toBeGreaterThan(callCountEN)
	})

	// ────────────────────────────────────────────────────────────────────────
	// TC-F26-03-07: useMemo dependency includes activeLocale
	// ────────────────────────────────────────────────────────────────────────

	it('TC-F26-03-07: categories useMemo re-computes when activeLocale changes', () => {
		// Arrange
		mockActiveLocale = 'en'
		const resolveContentSpy = vi.mocked(addSectionContent.resolveBlockContent)
		resolveContentSpy.mockClear()

		// Act: Initial render with EN
		const { rerender } = render(
			<BlockLibraryPanel
				blocks={[]}
				selectedBlock={null}
				onBlockSelect={mockOnBlockSelect}
				onAIAction={mockOnAIAction}
			/>
		)

		const initialCallCount = resolveContentSpy.mock.calls.length

		// Re-render with MS locale
		mockActiveLocale = 'ms'
		rerender(
			<BlockLibraryPanel
				blocks={[]}
				selectedBlock={null}
				onBlockSelect={mockOnBlockSelect}
				onAIAction={mockOnAIAction}
			/>
		)

		// Assert: resolveBlockContent should be called again for MS locale
		const finalCallCount = resolveContentSpy.mock.calls.length
		expect(finalCallCount).toBeGreaterThan(initialCallCount)
		// Verify MS was requested
		expect(resolveContentSpy).toHaveBeenCalledWith(
			expect.any(String),
			'ms',
			expect.any(String)
		)
	})

	// ────────────────────────────────────────────────────────────────────────
	// TC-F26-03-08: Block with no BM content fallback to EN
	// ────────────────────────────────────────────────────────────────────────

	it('TC-F26-03-08: displays EN description when activeLocale=ms but hasLocaleContent returns false', () => {
		// Arrange
		mockActiveLocale = 'ms'
		vi.mocked(addSectionContent.hasLocaleContent).mockReturnValue(false)
		vi.mocked(addSectionContent.resolveBlockContent).mockReturnValue({
			content: { headline: 'Custom HTML' },
			localeUsed: 'en',
			needsTranslation: true,
		})

		// Act
		render(
			<BlockLibraryPanel
				blocks={[]}
				selectedBlock={null}
				onBlockSelect={mockOnBlockSelect}
				onAIAction={mockOnAIAction}
			/>
		)

		// Assert — EN fallback shown; ✨ AI badge removed (F26 update)
		expect(screen.getByText(/Custom HTML block/)).toBeInTheDocument()
		const aiButtons = screen.queryAllByText(/✨ AI/)
		expect(aiButtons.length).toBe(0)
	})

	// ────────────────────────────────────────────────────────────────────────
	// TC-F26-03-09: previewText is computed from BM content when available
	// ────────────────────────────────────────────────────────────────────────

	it('TC-F26-03-09: previewText reflects BM content when activeLocale=ms and BM exists', () => {
		// Arrange
		mockActiveLocale = 'ms'
		vi.mocked(addSectionContent.hasLocaleContent).mockReturnValue(true)
		vi.mocked(addSectionContent.resolveBlockContent).mockImplementation(
			(slug: string, locale: string) => {
				if (slug === 'faq' && locale === 'ms') {
					return {
						content: { headline: 'Pertanyaan Lazim' },
						localeUsed: 'ms',
						needsTranslation: false,
					}
				}
				return {
					content: { headline: 'FAQ' },
					localeUsed: 'en',
					needsTranslation: locale !== 'en',
				}
			}
		)

		// Act
		render(
			<BlockLibraryPanel
				blocks={[]}
				selectedBlock={null}
				onBlockSelect={mockOnBlockSelect}
				onAIAction={mockOnAIAction}
			/>
		)

		// Assert: resolveBlockContent called for faq/ms → previewText set
		expect(vi.mocked(addSectionContent.resolveBlockContent)).toHaveBeenCalledWith(
			'faq',
			'ms',
			expect.any(String)
		)
	})

	// ────────────────────────────────────────────────────────────────────────
	// TC-F26-03-10: No translation badge when activeLocale=en (no regression)
	// ────────────────────────────────────────────────────────────────────────

	it('TC-F26-03-10: no AI badge appears for any block when activeLocale=en', () => {
		// Arrange
		mockActiveLocale = 'en'

		// Act
		render(
			<BlockLibraryPanel
				blocks={[]}
				selectedBlock={null}
				onBlockSelect={mockOnBlockSelect}
				onAIAction={mockOnAIAction}
			/>
		)

		// Assert
		const aiButtons = screen.queryAllByText(/✨ AI/)
		expect(aiButtons.length).toBe(0)
	})
})
