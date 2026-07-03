/**
 * TC-GENPERF-W2-01..05, W2-10 — Parallel page split (Phase 05, Wave 2)
 * Source: plans/260703-1341-gen-perf-async-parallel/phase-07-wave2-tests-verify.md
 *
 * Tests the pure functions and async orchestration for parallel 3-call split:
 * home ∥ subpage batch 1 (About+Services) ∥ batch 2 (Contact+Blog).
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import {
	buildBrief,
	buildHomeSystemPrompt,
	buildSubpagesSystemPrompt,
	scopedUserPrompt,
	safeParseJson,
	mergeSplitParsed,
	runParallelPageSplit,
	applyDeterministicChrome,
	type ParallelSplitInput,
} from '@/lib/ai/gen-page-split'

// Mock dependencies at top level
vi.mock('@/lib/ai/block-i18n', async (importOriginal) => ({
	// Keep real getBlockStrings — applyDeterministicChrome's buildNavigation
	// needs it (phase-09); only nav-label lookup is stubbed.
	...(await importOriginal<object>()),
	getNavLabels: vi.fn((lang: string) => {
		if (lang === 'en') {
			return { home: 'Home', about: 'About', services: 'Services', contact: 'Contact' }
		} else if (lang === 'vi') {
			return { home: 'Trang chủ', about: 'Giới thiệu', services: 'Dịch vụ', contact: 'Liên hệ' }
		}
		return null
	}),
}))

vi.mock('@/lib/ai/fallback-adapter', () => ({
	composeTemplateResult: vi.fn(() => ({
		siteName: 'Fallback Site',
		siteType: 'business',
		theme: { palette: 'blue' },
		seo: { title: 'Default' },
		language: 'en',
		pages: [
			{ title: 'Homepage', slug: '/', isHomepage: true, blocks: [] },
			{ title: 'About', slug: '/about', isHomepage: false, blocks: [] },
		],
	})),
}))

vi.mock('@/lib/ai/log-usage', () => ({
	logAiUsage: vi.fn(),
}))

describe('[TC-GENPERF-W2-01] buildBrief — deterministic nav labels', () => {
	it('TC-GENPERF-W2-01: returns navLabels for known language (en)', () => {
		// Arrange, Act
		const brief = buildBrief('en')

		// Assert
		expect(brief.navLabels).toBeDefined()
		expect(brief.navLabels?.home).toBe('Home')
		expect(brief.navLabels?.about).toBe('About')
		expect(brief.navLabels?.services).toBe('Services')
		expect(brief.navLabels?.contact).toBe('Contact')
	})

	it('TC-GENPERF-W2-01: returns navLabels for Vietnamese', () => {
		// Arrange, Act
		const brief = buildBrief('vi')

		// Assert
		expect(brief.navLabels?.home).toBe('Trang chủ')
		expect(brief.navLabels?.about).toBe('Giới thiệu')
	})

	it('TC-GENPERF-W2-01: returns null navLabels for unknown language', () => {
		// Arrange, Act
		const brief = buildBrief('unknown')

		// Assert
		expect(brief.navLabels).toBeNull()
	})
})

describe('[TC-GENPERF-W2-02] buildHomeSystemPrompt — home-only scope', () => {
	it('TC-GENPERF-W2-02: injects SCOPE OVERRIDE for homepage', () => {
		// Arrange
		const basePrompt = 'Base system prompt'
		const brief = buildBrief('en')

		// Act
		const result = buildHomeSystemPrompt(basePrompt, brief)

		// Assert
		expect(result).toContain('SCOPE OVERRIDE')
		expect(result).toContain('HOMEPAGE ONLY')
		expect(result).toContain('isHomepage": true')
		expect(result).toContain('Home="Home"')
	})

	it('TC-GENPERF-W2-02: includes nav labels when available', () => {
		// Arrange
		const basePrompt = 'Base'
		const brief = buildBrief('vi')

		// Act
		const result = buildHomeSystemPrompt(basePrompt, brief)

		// Assert
		expect(result).toContain('About="Giới thiệu"')
		expect(result).toContain('Services="Dịch vụ"')
	})
})

describe('[TC-GENPERF-W2-02] buildSubpagesSystemPrompt — batch scope', () => {
	it('TC-GENPERF-W2-02: marks batch count and page names', () => {
		// Arrange
		const basePrompt = 'Base'
		const brief = buildBrief('en')
		const batch = ['About', 'Services/Products']

		// Act
		const result = buildSubpagesSystemPrompt(basePrompt, brief, batch)

		// Assert
		expect(result).toContain('2 SUBPAGES ONLY (NO HOMEPAGE)')
		expect(result).toContain('About, Services/Products')
		expect(result).toContain('isHomepage": false')
	})

	it('TC-GENPERF-W2-02: notes Blog page requirement when present', () => {
		// Arrange
		const basePrompt = 'Base'
		const brief = buildBrief('en')
		const batchWithBlog = ['Contact', 'Blog']

		// Act
		const result = buildSubpagesSystemPrompt(basePrompt, brief, batchWithBlog)

		// Assert
		expect(result).toContain('blog-list block')
		expect(result).toContain('>=3 posts')
	})
})

describe('[TC-GENPERF-W2-02] scopedUserPrompt — user-level scope injection', () => {
	it('TC-GENPERF-W2-02: appends IMPORTANT scope line to user message', () => {
		// Arrange
		const baseUser = 'Generate a website'
		const scopeLine = 'Homepage only'

		// Act
		const result = scopedUserPrompt(baseUser, scopeLine)

		// Assert
		expect(result).toContain(baseUser)
		expect(result).toContain('IMPORTANT — OUTPUT SCOPE FOR THIS RESPONSE')
		expect(result).toContain('Homepage only')
		expect(result).toContain('will be discarded')
	})
})

describe('[TC-GENPERF-W2-03] safeParseJson — truncation repair', () => {
	it('TC-GENPERF-W2-03: parses valid JSON normally', () => {
		// Arrange
		const valid = '{"pages":[{"title":"Home"}]}'

		// Act
		const result = safeParseJson(valid)

		// Assert
		expect(result.pages).toBeDefined()
		expect(Array.isArray(result.pages)).toBe(true)
	})

	it('TC-GENPERF-W2-03: repairs truncated JSON ending at last }', () => {
		// Arrange
		// Truncated JSON after a complete object: everything after the first } is garbage
		const truncated = '{"siteName":"Test","category":"business"},"extra":"unclosed'

		// Act
		const result = safeParseJson(truncated)

		// Assert
		// After finding the last }, the repair gets:
		// {"siteName":"Test","category":"business"}
		expect(result.siteName).toBe('Test')
		expect(result.category).toBe('business')
		expect(result.extra).toBeUndefined()
	})

	it('TC-GENPERF-W2-03: throws on irreparable JSON with no closing brace', () => {
		// Arrange
		const invalid = '"no closing brace at all'

		// Act & Assert
		expect(() => safeParseJson(invalid)).toThrow('Invalid JSON response from AI')
	})

	it('TC-GENPERF-W2-03: throws when no closing brace found', () => {
		// Arrange
		const noBrace = 'no json here'

		// Act & Assert
		expect(() => safeParseJson(noBrace)).toThrow('Invalid JSON response from AI')
	})
})

describe('[TC-GENPERF-W2-02] mergeSplitParsed — merge shape', () => {
	it('TC-GENPERF-W2-02: merges home call and subpage batches into pages array', () => {
		// Arrange
		const homeParsed = {
			siteName: 'My Site',
			category: 'business',
			theme: { palette: 'blue' },
			seo: { title: 'Home' },
			language: 'en',
			pages: [{ title: 'Homepage', slug: '/', blocks: [], isHomepage: true }],
		}
		const subsParsed = {
			pages: [
				{ title: 'About', slug: '/about', blocks: [], isHomepage: false },
				{ title: 'Services', slug: '/services', blocks: [], isHomepage: false },
			],
		}

		// Act
		const result = mergeSplitParsed(homeParsed, subsParsed)

		// Assert
		expect(result.siteName).toBe('My Site')
		expect(result.category).toBe('business')
		expect(result.theme).toEqual({ palette: 'blue' })
		expect(result.language).toBe('en')
		expect(Array.isArray(result.pages)).toBe(true)
		expect((result.pages as any[]).length).toBe(3)
		expect((result.pages as any[])[0].isHomepage).toBe(true)
		expect((result.pages as any[])[1].isHomepage).toBe(false)
		expect((result.pages as any[])[2].isHomepage).toBe(false)
	})

	it('TC-GENPERF-W2-02: keeps site identity fields from home call', () => {
		// Arrange
		const homeParsed = {
			siteName: 'Brand',
			category: 'ecommerce',
			theme: { primary: 'red' },
			seo: { keywords: 'sales' },
			language: 'vi',
			pages: [],
		}
		const subsParsed = {
			pages: [{ title: 'Products', slug: '/products', blocks: [] }],
		}

		// Act
		const result = mergeSplitParsed(homeParsed, subsParsed)

		// Assert
		expect(result.siteName).toBe('Brand')
		expect(result.category).toBe('ecommerce')
		expect(result.theme).toEqual({ primary: 'red' })
	})

	it('TC-GENPERF-W2-02: handles legacy root-level blocks shape from home call', () => {
		// Arrange
		const homeParsed = {
			siteName: 'Legacy',
			category: 'business',
			theme: {},
			seo: {},
			language: 'en',
			blocks: [{ type: 'hero' }, { type: 'features' }],
		}
		const subsParsed = { pages: [] }

		// Act
		const result = mergeSplitParsed(homeParsed, subsParsed)

		// Assert
		expect(Array.isArray(result.pages)).toBe(true)
		expect((result.pages as any[])[0].isHomepage).toBe(true)
		expect((result.pages as any[])[0].blocks).toEqual([{ type: 'hero' }, { type: 'features' }])
	})
})

describe('[TC-GENPERF-W2-04] runParallelPageSplit — orchestration', () => {
	beforeEach(() => {
		process.env.GEN_PARALLEL_PAGES = 'true'
		vi.clearAllMocks()
	})

	afterEach(() => {
		delete process.env.GEN_PARALLEL_PAGES
	})

	it('TC-GENPERF-W2-04: makes 3 parallel calls (home + 2 batches)', async () => {
		// Arrange
		const mockOpenai = {
			chat: {
				completions: {
					create: vi.fn(async (opts: any) => ({
						model: 'gpt-4o',
						usage: { prompt_tokens: 500, completion_tokens: 1000 },
						choices: [
							{
								message: {
									content: JSON.stringify({
										siteName: 'Test',
										category: 'business',
										theme: { palette: 'blue' },
										seo: {},
										language: 'en',
										pages: [{ title: 'Home', slug: '/', isHomepage: true, blocks: [] }],
									}),
								},
							},
						],
					})),
				},
			},
		}

		const input: ParallelSplitInput = {
			openai: mockOpenai as any,
			model: 'gpt-4o',
			systemPrompt: 'System',
			userPromptText: 'User prompt',
			promptText: 'Prompt text',
			businessInfo: { businessName: 'Test', siteType: 'service' },
			seed: 42,
			language: 'en',
			blockLang: 'en',
		}

		// Act
		const result = await runParallelPageSplit(input)

		// Assert
		// Should have made 3 calls: home + batch1 + batch2
		expect(mockOpenai.chat.completions.create).toHaveBeenCalledTimes(3)
		expect(result.siteName).toBeDefined()
		expect(Array.isArray(result.pages)).toBe(true)
	})

	it('TC-GENPERF-W2-04: falls back to composer when subpage batch fails', async () => {
		// Arrange
		const { composeTemplateResult } = await import('@/lib/ai/fallback-adapter')
		const mockOpenai = {
			chat: {
				completions: {
					create: vi.fn(async (opts: any) => {
						// Identify the home call by its scope marker (calls run in
						// parallel — order-based detection is unreliable).
						const sys = String(opts.messages?.[0]?.content ?? '')
						if (sys.includes('HOMEPAGE ONLY')) {
							return {
								model: 'gpt-4o',
								usage: { prompt_tokens: 500, completion_tokens: 1000 },
								choices: [
									{
										message: {
											content: JSON.stringify({
												siteName: 'Test',
												category: 'business',
												theme: {},
												seo: {},
												language: 'en',
												pages: [{ title: 'Home', slug: '/', isHomepage: true, blocks: [] }],
											}),
										},
									},
								],
							}
						}
						// Subpage batch calls fail
						throw new Error('API timeout')
					}),
				},
			},
		}

		const input: ParallelSplitInput = {
			openai: mockOpenai as any,
			model: 'gpt-4o',
			systemPrompt: 'System',
			userPromptText: 'User prompt',
			promptText: 'Prompt text',
			businessInfo: { businessName: 'Test', siteType: 'service' },
			seed: 42,
			language: 'en',
			blockLang: 'en',
		}

		// Act
		const result = await runParallelPageSplit(input)

		// Assert — home from AI (siteName survives), composer fallback fired
		// for subpages, and NO duplicate slugs (scope-mix guard)
		expect(composeTemplateResult).toHaveBeenCalled()
		expect(result.siteName).toBe('Test')
		const pages = result.pages as Array<{ slug?: string; isHomepage?: boolean }>
		expect(Array.isArray(pages)).toBe(true)
		expect(pages[0]?.isHomepage).toBe(true)
		const slugs = pages.map((p) => p.slug)
		expect(new Set(slugs).size).toBe(slugs.length)
		expect(pages.filter((p) => p.isHomepage === true)).toHaveLength(1)
	})

	it('TC-GENPERF-W2-04: home call failure triggers composer fallback', async () => {
		// Arrange
		const { composeTemplateResult } = await import('@/lib/ai/fallback-adapter')
		let callCount = 0
		const mockOpenai = {
			chat: {
				completions: {
					create: vi.fn(async (opts: any) => {
						callCount++
						// First call (home) fails
						if (callCount === 1) {
							throw new Error('Home call failed')
						}
						// Subsequent calls (batches) succeed
						return {
							model: 'gpt-4o',
							usage: { prompt_tokens: 500, completion_tokens: 1000 },
							choices: [
								{
									message: {
										content: JSON.stringify({
											pages: [
												{ title: 'About', slug: '/about', blocks: [], isHomepage: false },
											],
										}),
									},
								},
							],
						}
					}),
				},
			},
		}

		const input: ParallelSplitInput = {
			openai: mockOpenai as any,
			model: 'gpt-4o',
			systemPrompt: 'System',
			userPromptText: 'User prompt',
			promptText: 'Prompt text',
			businessInfo: { businessName: 'Test', siteType: 'service' },
			seed: 42,
			language: 'en',
			blockLang: 'en',
		}

		// Act
		const result = await runParallelPageSplit(input)

		// Assert
		expect(composeTemplateResult).toHaveBeenCalled()
		expect(result.siteName).toBeDefined()
	})

	it('TC-GENPERF-W2-10: SSE ordering — home page appears first in pages array', async () => {
		// Arrange
		const mockOpenai = {
			chat: {
				completions: {
					create: vi.fn(async (opts: any) => ({
						model: 'gpt-4o',
						usage: { prompt_tokens: 500, completion_tokens: 1000 },
						choices: [
							{
								message: {
									content: JSON.stringify({
										siteName: 'Site',
										category: 'business',
										theme: {},
										seo: {},
										language: 'en',
										pages: [
											{ title: 'Home', slug: '/', isHomepage: true, blocks: [] },
											{ title: 'About', slug: '/about', isHomepage: false, blocks: [] },
										],
									}),
								},
							},
						],
					})),
				},
			},
		}

		const input: ParallelSplitInput = {
			openai: mockOpenai as any,
			model: 'gpt-4o',
			systemPrompt: 'System',
			userPromptText: 'User prompt',
			promptText: 'Prompt text',
			businessInfo: { businessName: 'Test', siteType: 'service' },
			seed: 42,
			language: 'en',
			blockLang: 'en',
		}

		// Act
		const result = await runParallelPageSplit(input)

		// Assert
		const pages = result.pages as any[]
		expect(pages[0].isHomepage).toBe(true)
		expect(pages[0].slug).toBe('/')
	})

	it('[TC-GENPERF-W2-12] Contact+Blog batch runs on the light model, others on the main model', async () => {
		// Arrange — capture the model of every dispatched call
		const seenModels: Array<{ scope: string; model: string }> = []
		const mockOpenai = {
			chat: {
				completions: {
					create: vi.fn(async (opts: any) => {
						const sys = String(opts.messages?.[0]?.content ?? '')
						const scope = sys.includes('HOMEPAGE ONLY') ? 'home' : sys.includes('Contact, Blog') ? 'light-batch' : 'main-batch'
						seenModels.push({ scope, model: opts.model })
						return {
							model: opts.model,
							usage: { prompt_tokens: 100, completion_tokens: 100 },
							choices: [{ message: { content: JSON.stringify({ siteName: 'X', category: 'business', theme: {}, seo: {}, language: 'en', pages: [{ title: 'P', slug: scope === 'home' ? '/' : '/p-' + seenModels.length, isHomepage: scope === 'home', blocks: [] }] }) } }],
						}
					}),
				},
			},
		}
		const input: ParallelSplitInput = {
			openai: mockOpenai as any,
			model: 'gpt-4.1-mini',
			systemPrompt: 'System',
			userPromptText: 'User prompt',
			promptText: 'Prompt text',
			businessInfo: { businessName: 'Test', siteType: 'service' },
			seed: 42,
			language: 'en',
			blockLang: 'en',
		}

		// Act
		await runParallelPageSplit(input)

		// Assert — light batch on nano (default of site-generation-subpages-light),
		// home + About/Services batch on the caller's main model
		const light = seenModels.find((m) => m.scope === 'light-batch')
		expect(light?.model).toBe('gpt-4.1-nano')
		expect(seenModels.find((m) => m.scope === 'home')?.model).toBe('gpt-4.1-mini')
		expect(seenModels.find((m) => m.scope === 'main-batch')?.model).toBe('gpt-4.1-mini')
	})

	it('[TC-GENPERF-W2-11] applyDeterministicChrome — nav on every page, home footer cloned, GPT chrome stripped', () => {
		// Arrange — GPT emitted its own nav everywhere + a stray footer on a subpage
		const merged: Record<string, unknown> = {
			pages: [
				{ title: 'Home', slug: '/', isHomepage: true, blocks: [{ blockType: 'navigation', logoText: 'GPT' }, { blockType: 'hero' }, { blockType: 'footer', columns: [{ title: 'Real' }] }] },
				{ title: 'About', slug: '/about', isHomepage: false, blocks: [{ blockType: 'navigation', logoText: 'GPT' }, { blockType: 'about' }, { blockType: 'footer', columns: [{ title: 'Stray' }] }] },
			],
		}

		// Act
		applyDeterministicChrome(merged, { businessName: 'Cơm Ba Má', industry: 'Nhà hàng' } as never, 'vi')

		// Assert
		const pages = merged.pages as Array<{ blocks: Array<Record<string, unknown>> }>
		for (const page of pages) {
			expect(page.blocks[0]!.blockType).toBe('navigation')
			expect(page.blocks[0]!.logoText).toBe('Cơm Ba Má') // deterministic, not GPT's
			expect(page.blocks.filter((b) => b.blockType === 'navigation')).toHaveLength(1)
		}
		// Home keeps ITS footer; subpage's stray footer replaced by the home clone
		const homeFooter = pages[0]!.blocks.find((b) => b.blockType === 'footer') as { columns: Array<{ title: string }> }
		const aboutFooter = pages[1]!.blocks.find((b) => b.blockType === 'footer') as { columns: Array<{ title: string }> }
		expect(homeFooter.columns[0]!.title).toBe('Real')
		expect(aboutFooter.columns[0]!.title).toBe('Real')
		// Subpage footer is LAST block
		expect(pages[1]!.blocks[pages[1]!.blocks.length - 1]!.blockType).toBe('footer')
	})
})
