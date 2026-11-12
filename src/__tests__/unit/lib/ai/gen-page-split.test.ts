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
	outputMatchesLocale,
	runParallelPageSplit,
	applyDeterministicChrome,
	syncFooterAcrossPages,
	materializeLocaleSafePage,
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
			{ title: 'Menu', slug: '/menu', isHomepage: false, blocks: [] },
			{ title: 'Gallery', slug: '/gallery', isHomepage: false, blocks: [] },
			{ title: 'Contact', slug: '/contact', isHomepage: false, blocks: [] },
			{ title: 'Blog', slug: '/blog', isHomepage: false, blocks: [] },
		],
	})),
}))

const { mockCompleteComposed } = vi.hoisted(() => ({ mockCompleteComposed: vi.fn() }))
// The split steps are AI platform tasks (sitegen.page-blocks) reached through completeComposed.
// The actor scope is faked: an actor is present, and each call answers via the fixture below.
vi.mock('@/lib/ai-platform/actor-scope', () => ({
	completeComposed: (...args: unknown[]) => mockCompleteComposed(...args),
	currentAiActor: () => ({ tenantId: '1' }),
	AiUnavailableError: class AiUnavailableError extends Error {},
}))

/** The composed request as the model sees it (system + user); the reply is the model's JSON text. */
function bindPlatform(fixture: { chat: { completions: { create: (opts: { messages: Array<{ role: string; content: string }> }) => Promise<any> } } }) {
	mockCompleteComposed.mockImplementation(async (_taskId: string, messages: { system: string; user: string }) => {
		const reply = await fixture.chat.completions.create({ messages: [{ role: 'system', content: messages.system }, { role: 'user', content: messages.user }] })
		return { content: reply.choices[0].message.content, model: reply.model ?? 'test', inputTokens: reply.usage?.prompt_tokens ?? 0, outputTokens: reply.usage?.completion_tokens ?? 0 }
	})
}

describe('[TC-GENPERF-W2-01] buildBrief — deterministic nav labels', () => {
	it('keeps footer identity fields intact when repairing Malay copy', () => {
		const page = {
			title: 'Home',
			slug: '/',
			blocks: [{
				blockType: 'footer',
				variant: 'dark-gradient',
				logoText: 'English placeholder',
				tagline: 'Professional beauty services in a calm private studio.',
				columns: [
					{
						title: 'Explore',
						links: [
							{ label: 'Home', url: '/' },
							{ label: 'About', url: '/about' },
						],
					},
					{ title: 'Company', links: [{ label: 'Contact', url: '/contact' }] },
				],
				copyrightText: '© 2026 English placeholder. All rights reserved.',
				socials: [{ platform: 'instagram', url: '#' }],
			}],
		}

		const result = materializeLocaleSafePage(
			page,
			{
				businessName: 'Luna Beauty Studio',
				industry: 'beauty',
				products: 'Rawatan muka, Manikur, Pedikur',
				shortDescription: 'Studio kecantikan wanita di Petaling Jaya yang menawarkan rawatan profesional dalam suasana selesa dan peribadi.',
			},
			{
				navigation: { home: 'Utama', about: 'Tentang Kami', services: 'Perkhidmatan', contact: 'Hubungi', getStarted: 'Mulakan', blog: 'Blog' },
				sections: { about: 'Tentang Kami', gallery: 'Galeri', contact: 'Hubungi Kami', features: 'Ciri-ciri', testimonials: 'Testimoni', faq: 'Soalan Lazim', team: 'Pasukan', serviceCards: 'Perkhidmatan', stats: 'Statistik', pricing: 'Harga', newsletter: 'Langgan', clientLogos: 'Dipercayai Oleh', blogList: 'Blog', contactSubmitLabel: 'Hantar', aboutHeadlinePrefix: 'Tentang' },
				newsletter: { buttonLabel: 'Langgan', emailPlaceholder: 'E-mel' },
				blogList: { readArticleLabel: 'Baca Artikel', uncategorizedLabel: 'Tanpa Kategori', emptyStateLabel: 'Belum ada artikel.' },
				contact: { headline: 'Hubungi Kami', subheadline: 'Hubungi kami hari ini.', nameLabel: 'Nama', emailLabel: 'E-mel', phoneLabel: 'Telefon', addressLabel: 'Alamat', messageLabel: 'Mesej', submitLabel: 'Hantar Mesej' },
				footer: { exploreLabel: 'Terokai', companyLabel: 'Syarikat', supportLabel: 'Sokongan', legalLabel: 'Undang-undang', allRightsReserved: 'Hak cipta terpelihara.' },
			},
			'ms',
		)
		const footer = (result.blocks as unknown as Array<Record<string, unknown>>)[0]!
		const columns = footer.columns as Array<{ title: string; links: Array<{ label: string }> }>

		expect(footer.logoText).toBe('Luna Beauty Studio')
		expect(footer.logoText).not.toBe('Studio kecantikan wanita di Petaling Jaya yang menawarkan rawatan profesional dalam suasana selesa dan peribadi.')
		expect(footer.copyrightText).toBe(`© ${new Date().getFullYear()} Luna Beauty Studio. Hak cipta terpelihara.`)
		expect(columns[0]?.title).toBe('Terokai')
		expect(columns[0]?.links.map((link) => link.label)).toEqual(['Utama', 'Tentang Kami'])
		expect(columns[1]?.title).toBe('Syarikat')
		expect(columns[1]?.links.map((link) => link.label)).toEqual(['Hubungi'])
		expect((footer.socials as Array<{ platform: string }>)[0]?.platform).toBe('instagram')
	})

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

describe('[TC-F01-CONTACT-KEY-04] materializeLocaleSafePage — contact form fields', () => {
	it('TC-F01-CONTACT-KEY-04: keeps contact fieldName/fieldType/required and does not stamp the email placeholder on form fields', () => {
		// Arrange
		const page = {
			title: 'Contact',
			slug: '/contact',
			blocks: [{
				blockType: 'contact',
				formFields: [
					{ fieldName: 'name', fieldType: 'text', label: 'Name', placeholder: 'Your name', required: true },
					{ fieldName: 'message', fieldType: 'textarea', label: 'Message', placeholder: 'Your message', required: false },
				],
			}],
		}

		// Act
		const result = materializeLocaleSafePage(
			page,
			{
				businessName: 'Kedai Kopi',
				industry: 'cafe',
				products: 'Kopi, Teh',
				shortDescription: 'Kedai kopi Ipoh untuk ujian QA dengan suasana selesa dan peribadi untuk semua pelanggan.',
			},
			{
				navigation: { home: 'Utama', about: 'Tentang Kami', services: 'Perkhidmatan', contact: 'Hubungi', getStarted: 'Mulakan', blog: 'Blog' },
				sections: { about: 'Tentang Kami', gallery: 'Galeri', contact: 'Hubungi Kami', features: 'Ciri-ciri', testimonials: 'Testimoni', faq: 'Soalan Lazim', team: 'Pasukan', serviceCards: 'Perkhidmatan', stats: 'Statistik', pricing: 'Harga', newsletter: 'Langgan', clientLogos: 'Dipercayai Oleh', blogList: 'Blog', contactSubmitLabel: 'Hantar', aboutHeadlinePrefix: 'Tentang' },
				newsletter: { buttonLabel: 'Langgan', emailPlaceholder: 'E-mel' },
				blogList: { readArticleLabel: 'Baca Artikel', uncategorizedLabel: 'Tanpa Kategori', emptyStateLabel: 'Belum ada artikel.' },
				contact: { headline: 'Hubungi Kami', subheadline: 'Hubungi kami hari ini.', nameLabel: 'Nama', emailLabel: 'E-mel', phoneLabel: 'Telefon', addressLabel: 'Alamat', messageLabel: 'Mesej', submitLabel: 'Hantar Mesej' },
				footer: { exploreLabel: 'Terokai', companyLabel: 'Syarikat', supportLabel: 'Sokongan', legalLabel: 'Undang-undang', allRightsReserved: 'Hak cipta terpelihara.' },
			},
			'ms',
		)

		// Assert
		const block = (result.blocks as Array<Record<string, unknown>>)[0]!
		const fields = block.formFields as Array<Record<string, unknown>>
		expect(fields.map((f) => f.fieldName)).toEqual(['name', 'message'])
		expect(fields.map((f) => f.fieldType)).toEqual(['text', 'textarea'])
		expect(fields.map((f) => f.required)).toEqual([true, false])
		expect(fields.map((f) => f.placeholder)).toEqual(['', ''])
		expect(fields.map((f) => f.label)).toEqual(['Name', 'Message'])
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

	it('TC-F01-LOCALE-PERF-05: requests locale context inside the existing homepage call', () => {
		const result = buildHomeSystemPrompt('Base', buildBrief('de-contract'))

		expect(result).toContain('REQUIRED LOCALE CONTEXT')
		expect(result).toContain('"readArticleLabel"')
		expect(result).toContain('"allRightsReserved"')
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
        expect(result).toContain('blog-list')
		expect(result).toContain('>=3 posts')
	})

	it('keeps the Contact page compact and excludes unrelated content blocks', () => {
		const result = buildSubpagesSystemPrompt('Base', buildBrief('en'), ['Contact', 'Blog'])

		expect(result).toContain('exactly one contact block')
		expect(result).toContain('Blog: 3-4 content blocks')
		expect(result).toContain('Do NOT add contact or gallery blocks to About, Services/Products, or Blog')
	})

	it('gives About and Services separate page-specific block contracts', () => {
		const result = buildSubpagesSystemPrompt('Base', buildBrief('en'), ['About', 'Services/Products'])

		expect(result).toContain('About: 4-6 content blocks')
		expect(result).toContain('Services/Products: 4-6 content blocks')
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

describe('outputMatchesLocale — final generation guard', () => {
	it('rejects a German site containing substantial English page copy', () => {
		expect(outputMatchesLocale({
			pages: [{
				slug: '/services',
				blocks: [{
					blockType: 'service-cards',
					headline: 'Our Services',
					subheadline: 'Discover what our professional consulting team can do for you.',
					services: [
						{ title: 'Strategy Consulting', description: 'C-suite advisory and market strategy development for growing companies.' },
						{ title: 'Market Entry', description: 'Comprehensive market research and entry planning for international markets.' },
					],
				}],
			}],
		}, 'de')).toBe(false)
	})

	it('accepts substantial German page copy', () => {
		expect(outputMatchesLocale({
			pages: [{
				slug: '/leistungen',
				blocks: [{
					blockType: 'service-cards',
					headline: 'Unsere Leistungen',
					subheadline: 'Entdecken Sie unsere professionelle Beratung für nachhaltige und funktionale Innenarchitektur.',
					services: [
						{ title: 'Raumplanung', description: 'Durchdachte Konzepte für Familien, Wohnungen und wachsende Unternehmen.' },
						{ title: 'Persönliche Beratung', description: 'Individuelle Begleitung von der ersten Idee bis zur verlässlichen Umsetzung.' },
					],
				}],
			}],
		}, 'de')).toBe(true)
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

	it('[TC-GENPERF-W2-14] forces homepage slug to "/" even when the home call returns a subpage', () => {
		// Arrange — scope-ignoring home call returned an About page (same
		// failure class measured on batches, live 2026-07-03). Keeping its
		// '/about' slug would collide with the real batch page at page-create
		// (unique site+slug constraint).
		const homeParsed = {
			siteName: 'Rogue',
			category: 'business',
			theme: {},
			seo: {},
			language: 'en',
			pages: [{ title: 'About Us', slug: '/about', blocks: [{ blockType: 'about' }], isHomepage: false }],
		}
		const subsParsed = {
			pages: [{ title: 'About', slug: '/about', blocks: [], isHomepage: false }],
		}

		// Act
		const result = mergeSplitParsed(homeParsed, subsParsed)

		// Assert
		const pages = result.pages as unknown as Array<Record<string, unknown>>
		expect(pages[0]!.slug).toBe('/')
		expect(pages[0]!.isHomepage).toBe(true)
		// Exactly one page may carry the '/about' slug (the batch one)
		expect(pages.filter((p) => p.slug === '/about')).toHaveLength(1)
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
		// Arrange — scope-aware mock returning the CORRECT page count per call
		// (a generic 1-page response would now trigger the batch retry pass
		// and inflate the call count).
		const scopedResponse = (pages: Array<Record<string, unknown>>) => ({
			model: 'gpt-4o',
			usage: { prompt_tokens: 500, completion_tokens: 1000 },
			choices: [{ message: { content: JSON.stringify({
				siteName: 'Test', category: 'business', theme: { palette: 'blue' }, seo: {}, language: 'en', pages,
			}) } }],
		})
		const mockOpenai = {
			chat: {
				completions: {
					create: vi.fn(async (opts: any) => {
						const sys = String(opts.messages?.[0]?.content ?? '')
						if (sys.includes('HOMEPAGE ONLY')) {
							return scopedResponse([{ title: 'Home', slug: '/', isHomepage: true, blocks: [] }])
						}
						if (sys.includes('Contact, Blog')) {
							return scopedResponse([
								{ title: 'Contact', slug: '/contact', isHomepage: false, blocks: [] },
								{ title: 'Blog', slug: '/blog', isHomepage: false, blocks: [] },
							])
						}
						return scopedResponse([
							{ title: 'About', slug: '/about', isHomepage: false, blocks: [] },
							{ title: 'Services', slug: '/services', isHomepage: false, blocks: [] },
						])
					}),
				},
			},
		}

		const input: ParallelSplitInput = {
			systemPrompt: 'System',
			userPromptText: 'User prompt',
			promptText: 'Prompt text',
			businessInfo: { businessName: 'Test', siteType: 'service' },
			seed: 42,
			language: 'en',
			blockLang: 'en',
		}

		// Act
		bindPlatform(mockOpenai)
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
			systemPrompt: 'System',
			userPromptText: 'User prompt',
			promptText: 'Prompt text',
			businessInfo: { businessName: 'Test', siteType: 'service' },
			seed: 42,
			language: 'en',
			blockLang: 'en',
		}

		// Act
		bindPlatform(mockOpenai)
		const result = await runParallelPageSplit(input)

		// Assert — home from AI (siteName survives), composer fallback fired
		// for subpages, and NO duplicate slugs (scope-mix guard)
		expect(composeTemplateResult).toHaveBeenCalled()
		expect(result.siteName).toBe('Test')
		const pages = result.pages as Array<{ slug?: string; isHomepage?: boolean }>
		expect(Array.isArray(pages)).toBe(true)
		expect(pages).toHaveLength(5)
		expect(pages.map((p) => p.slug)).toEqual(['/', '/about', '/services', '/contact', '/blog'])
		expect(pages[0]?.isHomepage).toBe(true)
		const slugs = pages.map((p) => p.slug)
		expect(new Set(slugs).size).toBe(slugs.length)
		expect(pages.filter((p) => p.isHomepage === true)).toHaveLength(1)
	})

	it('TC-F01-LOCALE-PERF-01: uses a locale-safe composer fallback without extra calls', async () => {
		const { composeTemplateResult } = await import('@/lib/ai/fallback-adapter')
		const germanHome = {
			title: 'Startseite',
			slug: '/',
			isHomepage: true,
			blocks: [{
				blockType: 'hero',
				headline: 'Nachhaltige Innenarchitektur für moderne Lebensräume',
				subheadline: 'Wir gestalten funktionale und hochwertige Räume für Familien und Unternehmen in Berlin mit persönlicher Beratung und sorgfältiger Planung.',
			}],
		}
		const mockOpenai = {
			chat: {
				completions: {
					create: vi.fn(async (opts: any) => {
						const sys = String(opts.messages?.[0]?.content ?? '')
						if (sys.includes('HOMEPAGE ONLY')) {
							return {
								model: 'gpt-4o',
								usage: { prompt_tokens: 100, completion_tokens: 200 },
								choices: [{ message: { content: JSON.stringify({
									siteName: 'GrünRaum',
									category: 'business',
									theme: {},
									seo: {},
									language: 'en',
									pages: [germanHome],
								}) } }],
							}
						}
						throw new Error('API timeout')
					}),
				},
			},
		}

		bindPlatform(mockOpenai)
		const result = await runParallelPageSplit({
			systemPrompt: 'System',
			userPromptText: 'Website auf Deutsch erstellen',
			promptText: 'GrünRaum Innenarchitektur',
			businessInfo: {
				businessName: 'GrünRaum',
				industry: 'interior-design',
				products: 'Innenarchitektur, Raumplanung',
				shortDescription: 'Nachhaltige Raumgestaltung für Familien und Unternehmen in Berlin.',
			},
			seed: 42,
			// Latin locales use the legacy content enum while blockLang carries
			// the actual requested output locale.
			language: 'en',
			blockLang: 'de',
		})

		expect(mockOpenai.chat.completions.create).toHaveBeenCalledTimes(3)
		expect(vi.mocked(composeTemplateResult)).toHaveBeenCalledTimes(1)
		expect((result.pages as Array<{ slug: string }>).map((page) => page.slug)).toEqual([
			'/', '/about', '/services', '/contact', '/blog',
		])
		const homepage = (result.pages as Array<{
			slug: string
			blocks: Array<Record<string, unknown>>
		}>).find((page) => page.slug === '/')
		expect(homepage?.blocks[1]?.headline).toBe(
			'Nachhaltige Innenarchitektur für moderne Lebensräume',
		)
	})

	it('TC-F01-LOCALE-PERF-02: repairs wrong-locale page copy locally without retrying', async () => {
		const { composeTemplateResult } = await import('@/lib/ai/fallback-adapter')
		const response = (pages: Array<Record<string, unknown>>) => ({
			model: 'gpt-4o',
			usage: { prompt_tokens: 100, completion_tokens: 200 },
			choices: [{ message: { content: JSON.stringify({
				siteName: 'GrünRaum',
				category: 'business',
				theme: {},
				seo: {},
				language: 'en',
				pages,
			}) } }],
		})
		const germanPage = (title: string, slug: string) => ({
			title,
			slug,
			isHomepage: slug === '/',
			blocks: [{
				blockType: slug === '/' ? 'hero' : 'about',
				headline: `${title} für nachhaltige Innenarchitektur`,
				body: 'Wir entwickeln durchdachte, funktionale und hochwertige Raumkonzepte für Familien und Unternehmen mit persönlicher Beratung, klarer Planung und verlässlicher Umsetzung.',
			}],
		})
		const englishPage = (title: string, slug: string) => ({
			title,
			slug,
			isHomepage: false,
			blocks: [{
				blockType: 'about',
				headline: `Our ${title}`,
				body: 'Discover professional strategy consulting, market entry planning, trusted advisory services and practical solutions for growing companies across every industry.',
			}],
		})
		const mockOpenai = {
			chat: {
				completions: {
					create: vi.fn(async (opts: any) => {
						const sys = String(opts.messages?.[0]?.content ?? '')
						if (sys.includes('HOMEPAGE ONLY')) {
							return response([germanPage('Startseite', '/')])
						}
						const contactBatch = sys.includes('Contact, Blog')
						const pages = contactBatch
							? [
								englishPage('Kontakt', '/contact'),
								englishPage('Magazin', '/blog'),
							]
							: [
								englishPage('Über uns', '/about'),
								englishPage('Leistungen', '/services'),
							]
						return response(pages)
					}),
				},
			},
		}

		bindPlatform(mockOpenai)
		const result = await runParallelPageSplit({
			systemPrompt: 'System',
			userPromptText: 'Website auf Deutsch erstellen',
			promptText: 'GrünRaum Innenarchitektur',
			businessInfo: {
				businessName: 'GrünRaum',
				industry: 'interior-design',
				products: 'Innenarchitektur, Raumplanung',
				shortDescription: 'Wir gestalten nachhaltige und funktionale Räume in Berlin.',
			},
			seed: 42,
			language: 'en',
			blockLang: 'de',
		})

		expect(mockOpenai.chat.completions.create).toHaveBeenCalledTimes(3)
		expect(vi.mocked(composeTemplateResult)).not.toHaveBeenCalled()
		expect((result.pages as Array<{ slug: string }>).map((page) => page.slug)).toEqual([
			'/', '/about', '/services', '/contact', '/blog',
		])
		expect(JSON.stringify(result)).not.toContain('Discover professional strategy consulting')
		expect(JSON.stringify(result)).toContain('Wir gestalten nachhaltige')
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
			systemPrompt: 'System',
			userPromptText: 'User prompt',
			promptText: 'Prompt text',
			businessInfo: { businessName: 'Test', siteType: 'service' },
			seed: 42,
			language: 'en',
			blockLang: 'en',
		}

		// Act
		bindPlatform(mockOpenai)
		const result = await runParallelPageSplit(input)

		// Assert
		expect(composeTemplateResult).toHaveBeenCalled()
		expect(result.siteName).toBeDefined()
	})

	it('[TC-GENPERF-W2-15] valid JSON without a homepage triggers composer fallback', async () => {
		const { composeTemplateResult } = await import('@/lib/ai/fallback-adapter')
		const response = (pages: Array<Record<string, unknown>>, extra: Record<string, unknown> = {}) => ({
			model: 'gpt-4o',
			usage: { prompt_tokens: 100, completion_tokens: 200 },
			choices: [{ message: { content: JSON.stringify({ ...extra, pages }) } }],
		})
		const mockOpenai = {
			chat: {
				completions: {
					create: vi.fn(async (opts: any) => {
						const sys = String(opts.messages?.[0]?.content ?? '')
						if (sys.includes('HOMEPAGE ONLY')) {
							return response([], { siteName: 'Malformed AI Home' })
						}
						if (sys.includes('Contact, Blog')) {
							return response([
								{ title: 'Contact', slug: '/contact', blocks: [] },
								{ title: 'Blog', slug: '/blog', blocks: [] },
							])
						}
						return response([
							{ title: 'About', slug: '/about', blocks: [] },
							{ title: 'Services', slug: '/services', blocks: [] },
						])
					}),
				},
			},
		}

		bindPlatform(mockOpenai)
		const result = await runParallelPageSplit({
			systemPrompt: 'System',
			userPromptText: 'User prompt',
			promptText: 'Prompt text',
			businessInfo: { businessName: 'Test', siteType: 'service' },
			seed: 42,
			language: 'en',
			blockLang: 'en',
		})

		expect(composeTemplateResult).toHaveBeenCalled()
		expect(result.siteName).toBe('Fallback Site')
		const pages = result.pages as Array<{ slug?: string; isHomepage?: boolean }>
		expect(pages).toHaveLength(5)
		expect(pages[0]).toMatchObject({ slug: '/', isHomepage: true })
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
			systemPrompt: 'System',
			userPromptText: 'User prompt',
			promptText: 'Prompt text',
			businessInfo: { businessName: 'Test', siteType: 'service' },
			seed: 42,
			language: 'en',
			blockLang: 'en',
		}

		// Act
		bindPlatform(mockOpenai)
		const result = await runParallelPageSplit(input)

		// Assert
		const pages = result.pages as any[]
		expect(pages[0].isHomepage).toBe(true)
		expect(pages[0].slug).toBe('/')
	})

	it('[TC-GENPERF-W2-13] structurally incomplete batch is retried once on the MAIN model before composer fallback', async () => {
		// Arrange — light batch returns incomplete JSON on nano, succeeds on retry
		const { composeTemplateResult } = await import('@/lib/ai/fallback-adapter')
		const scoped = (pages: Array<Record<string, unknown>>) => ({
			model: 'gpt-4o',
			usage: { prompt_tokens: 1, completion_tokens: 1 },
			choices: [{ message: { content: JSON.stringify({ siteName: 'T', category: 'business', theme: {}, seo: {}, language: 'en', pages }) } }],
		})
		let lightAttempts = 0
		const mockOpenai = {
			chat: {
				completions: {
					create: vi.fn(async (opts: any) => {
						const sys = String(opts.messages?.[0]?.content ?? '')
						if (sys.includes('HOMEPAGE ONLY')) return scoped([{ title: 'Home', slug: '/', isHomepage: true, blocks: [] }])
						if (sys.includes('Contact, Blog')) {
							// Light batch is valid JSON but misses Blog; MAIN-model retry succeeds.
							lightAttempts++
							if (lightAttempts === 1) {
								return scoped([{ title: 'Contact', slug: '/contact', isHomepage: false, blocks: [] }])
							}
							return scoped([
								{ title: 'Contact', slug: '/contact', isHomepage: false, blocks: [] },
								{ title: 'Blog', slug: '/blog', isHomepage: false, blocks: [] },
							])
						}
						return scoped([
							{ title: 'About', slug: '/about', isHomepage: false, blocks: [] },
							{ title: 'Services', slug: '/services', isHomepage: false, blocks: [] },
						])
					}),
				},
			},
		}
		const input: ParallelSplitInput = {
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
		bindPlatform(mockOpenai)
		const result = await runParallelPageSplit(input)

		// Assert — 4 calls (3 + 1 retry), full 5-page site from GPT, composer NOT used
		expect(mockOpenai.chat.completions.create).toHaveBeenCalledTimes(4)
		expect(vi.mocked(composeTemplateResult)).not.toHaveBeenCalled()
		const slugs = (result.pages as Array<{ slug?: string }>).map((p) => p.slug)
		expect(slugs).toEqual(['/', '/about', '/services', '/contact', '/blog'])
	})

	it('[TC-GENPERF-W2-12] every split call goes to sitegen.page-blocks; prime-web picks no model', async () => {
		// Arrange — the model tier is the platform task's (alias), so the caller sends only system + user + temperature
		const mockOpenai = {
			chat: {
				completions: {
					create: vi.fn(async (opts: any) => {
						const sys = String(opts.messages?.[0]?.content ?? '')
						const pages = sys.includes('HOMEPAGE ONLY')
							? [{ title: 'Home', slug: '/', isHomepage: true, blocks: [] }]
							: sys.includes('Contact, Blog')
								? [{ title: 'Contact', slug: '/contact', isHomepage: false, blocks: [] }, { title: 'Blog', slug: '/blog', isHomepage: false, blocks: [] }]
								: [{ title: 'About', slug: '/about', isHomepage: false, blocks: [] }, { title: 'Services', slug: '/services', isHomepage: false, blocks: [] }]
						return {
							model: 'test',
							usage: { prompt_tokens: 100, completion_tokens: 100 },
							choices: [{ message: { content: JSON.stringify({ siteName: 'X', category: 'business', theme: {}, seo: {}, language: 'en', pages }) } }],
						}
					}),
				},
			},
		}
		const input: ParallelSplitInput = {
			systemPrompt: 'System',
			userPromptText: 'User prompt',
			promptText: 'Prompt text',
			businessInfo: { businessName: 'Test', siteType: 'service' },
			seed: 42,
			language: 'en',
			blockLang: 'en',
		}

		// Act
		bindPlatform(mockOpenai)
		await runParallelPageSplit(input)

		// Assert — home + both batches on the same platform task; the request carries no model choice
		expect(mockCompleteComposed.mock.calls.map((call) => call[0])).toEqual(['sitegen.page-blocks', 'sitegen.page-blocks', 'sitegen.page-blocks'])
		expect(mockCompleteComposed.mock.calls.map((call) => Object.keys(call[1] as object).sort())).toEqual([
			['system', 'temperature', 'user'], ['system', 'temperature', 'user'], ['system', 'temperature', 'user'],
		])
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

	it('[TC-GENPERF-W2-15] chrome is share-nothing — mutating one page nav/footer never leaks to others', () => {
		// Arrange
		const merged: Record<string, unknown> = {
			pages: [
				{ title: 'Home', slug: '/', isHomepage: true, blocks: [{ blockType: 'hero' }, { blockType: 'footer', columns: [{ title: 'Real' }] }] },
				{ title: 'About', slug: '/about', isHomepage: false, blocks: [{ blockType: 'about' }] },
			],
		}
		applyDeterministicChrome(merged, { businessName: 'Cơm Ba Má', industry: 'Nhà hàng' } as never, 'vi')
		const pages = merged.pages as Array<{ blocks: Array<Record<string, unknown>> }>
		const homeNav = pages[0]!.blocks[0]!
		const aboutNav = pages[1]!.blocks[0]!

		// Act — downstream passes (structure enforcer, grid alignment) mutate
		// blocks in place; simulate a mutation on the HOME page only, deep
		// into the nested links/columns arrays (a shallow spread would leak it)
		expect(aboutNav).not.toBe(homeNav)
		homeNav.logoText = 'MUTATED'
		;(homeNav.links as unknown as Array<Record<string, unknown>>).push({ label: 'X', url: '/x' })
		const homeFooter = pages[0]!.blocks.find((b) => b.blockType === 'footer')!
		;(homeFooter.columns as unknown as Array<Record<string, unknown>>).push({ title: 'HomeOnly' })

		// Assert — About page chrome unaffected
		expect(aboutNav.logoText).toBe('Cơm Ba Má')
		expect((aboutNav.links as unknown[]).length).toBe((homeNav.links as unknown[]).length - 1)
		const aboutFooter = pages[1]!.blocks.find((b) => b.blockType === 'footer')!
		expect((aboutFooter.columns as Array<{ title: string }>).some((c) => c.title === 'HomeOnly')).toBe(false)

		// syncFooterAcrossPages (post-enforcer re-clone) must be share-nothing too
		syncFooterAcrossPages(pages)
		const aboutFooterSynced = pages[1]!.blocks.find((b) => b.blockType === 'footer')!
		expect(aboutFooterSynced).not.toBe(homeFooter)
		;(homeFooter.columns as unknown as Array<Record<string, unknown>>).push({ title: 'AfterSync' })
		expect((aboutFooterSynced.columns as Array<{ title: string }>).some((c) => c.title === 'AfterSync')).toBe(false)
	})

	it('[TC-GENPERF-W2-16] syncFooterAcrossPages converges footer VARIANT — home rotated → all subpages match', () => {
		// Reproduces the live symptom (2026-07-09): the structure enforcer rotates
		// ONLY the homepage footer variant (simple → minimal), leaving subpages on
		// the pre-enforcement clone (simple). syncFooterAcrossPages runs AFTER the
		// enforcer and must re-propagate the home variant so every page matches.
		const pages = [
			{ blocks: [{ blockType: 'hero' }, { blockType: 'footer', variant: 'simple' }] },
			{ blocks: [{ blockType: 'about' }, { blockType: 'footer', variant: 'simple' }] },
			{ blocks: [{ blockType: 'services' }, { blockType: 'footer', variant: 'simple' }] },
		]
		// Enforcer rotates HOME footer only:
		;(pages[0]!.blocks[1] as Record<string, unknown>).variant = 'minimal'

		syncFooterAcrossPages(pages)

		const variantOf = (pgIdx: number) =>
			(pages[pgIdx]!.blocks.find((b) => (b as Record<string, unknown>).blockType === 'footer') as Record<string, unknown>).variant
		expect(variantOf(0)).toBe('minimal')
		expect(variantOf(1)).toBe('minimal') // was 'simple' → synced
		expect(variantOf(2)).toBe('minimal')
		// exactly one footer per subpage (no dup)
		expect(pages[1]!.blocks.filter((b) => (b as Record<string, unknown>).blockType === 'footer')).toHaveLength(1)
	})
})
