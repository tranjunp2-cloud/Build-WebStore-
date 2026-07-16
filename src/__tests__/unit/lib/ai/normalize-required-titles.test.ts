/**
 * Unit Tests: normalizeChangesRequiredFields() / coerceServiceItems()
 * TC-ID: TC-F01.PGRID — Payload-required array-item title backfill (GH-1621)
 * Convention: docs/TEST_CONVENTION.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
    normalizeChangesRequiredFields,
    coerceServiceItems,
    sanitizeTestimonialItems,
    sanitizeBlocksRequiredFields,
    sanitizeSingleBlockRequiredFields,
} from '@/lib/ai/normalize-required-titles'

beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
})

describe('[TC-F01.PGRID] normalizeChangesRequiredFields()', () => {
    it('TC-F01.PGRID-01 — backfills blank/missing title on portfolio-grid.projects[]', () => {
        const changes = {
            projects: [
                { title: 'Real Project', image: 1 },
                { title: '', image: 2 },
                { image: 3 },
            ],
        }
        normalizeChangesRequiredFields(changes, { blockType: 'portfolio-grid' })
        const projects = changes.projects as Record<string, unknown>[]
        expect(projects[0]!.title).toBe('Real Project')
        expect(projects[1]!.title).toBe('Project 2')
        expect(projects[2]!.title).toBe('Project 3')
    })

    it('TC-F01.PGRID-02 — prefers name/heading over generic fallback when title missing', () => {
        const changes = { projects: [{ name: 'From Name' }, { heading: 'From Heading' }] }
        normalizeChangesRequiredFields(changes, { blockType: 'portfolio-grid' })
        const projects = changes.projects as Record<string, unknown>[]
        expect(projects[0]!.title).toBe('From Name')
        expect(projects[1]!.title).toBe('From Heading')
    })

    it('TC-F01.PGRID-03 — does not touch other block types (e.g. hero)', () => {
        const changes = { headline: 'Hi', ctaButtons: [{ label: '' }] }
        normalizeChangesRequiredFields(changes, { blockType: 'hero' })
        expect(changes).toEqual({ headline: 'Hi', ctaButtons: [{ label: '' }] })
    })

    it('TC-F01.PGRID-04 — no-op when portfolio-grid changes has no projects array', () => {
        const changes = { headline: 'New headline' }
        normalizeChangesRequiredFields(changes, { blockType: 'portfolio-grid' })
        expect(changes).toEqual({ headline: 'New headline' })
    })

    it('TC-F01.PGRID-05 — resolves blockType from `changes.blockType` when existingBlock is null (add-context)', () => {
        const changes = { blockType: 'portfolio-grid', projects: [{}] }
        normalizeChangesRequiredFields(changes, null)
        const projects = changes.projects as Record<string, unknown>[]
        expect(projects[0]!.title).toBe('Project 1')
    })

    it('TC-F01.PGRID-06 — warns and no-ops when blockType cannot be resolved', () => {
        const warnSpy = vi.spyOn(console, 'warn')
        const changes = { projects: [{}] }
        normalizeChangesRequiredFields(changes, null)
        expect(warnSpy).toHaveBeenCalled()
        expect((changes.projects as Record<string, unknown>[])[0]!.title).toBeUndefined()
    })

    it('TC-F01.PGRID-07 — booking-widget excluded (its required field is `name`, not `title`)', () => {
        const changes = { services: [{ name: 'Haircut' }] }
        normalizeChangesRequiredFields(changes, { blockType: 'booking-widget' })
        expect(changes).toEqual({ services: [{ name: 'Haircut' }] })
    })

    it('TC-F01.PGRID-08 — service-cards still routes through coerceServiceItems (title + description + icon)', () => {
        const changes = { services: ['Consulting', { title: '', text: 'Body copy' }] }
        normalizeChangesRequiredFields(changes, { blockType: 'service-cards' })
        const services = changes.services as Record<string, unknown>[]
        expect(services[0]).toEqual({ title: 'Consulting', icon: '⭐', description: '' })
        expect(services[1]).toEqual({ title: 'Service 2', text: 'Body copy', icon: '⭐', description: 'Body copy' })
    })

    it('TC-F01.PGRID-11 — portfolio-grid: bare string item keeps the AI\'s text as title, not a generic fallback', () => {
        // The edit-block prompt gives no shape guidance for `projects` (unlike
        // `services`, which documents an explicit object shape) — a bare string
        // response is a realistic AI shape here. Regression guard for the string
        // being silently discarded in favor of "Project N".
        const changes = { projects: ['Downtown Loft Renovation', { title: 'Real Project' }] }
        normalizeChangesRequiredFields(changes, { blockType: 'portfolio-grid' })
        const projects = changes.projects as Record<string, unknown>[]
        expect(projects[0]).toEqual({ title: 'Downtown Loft Renovation' })
        expect(projects[1]).toEqual({ title: 'Real Project' })
    })

    it('TC-F01.PGRID-13 — GH-1621 audit: team.members[].name backfilled (required, not `title`)', () => {
        const changes = { members: [{ name: 'Alice' }, { role: 'CTO' }] }
        normalizeChangesRequiredFields(changes, { blockType: 'team' })
        const members = changes.members as Record<string, unknown>[]
        expect(members[0]!.name).toBe('Alice')
        expect(members[1]!.name).toBe('Team Member 2')
    })

    it('TC-F01.PGRID-14 — GH-1621 audit: doctor-profile.doctors[].name backfilled', () => {
        const changes = { doctors: [{}, { name: 'Dr. Lee' }] }
        normalizeChangesRequiredFields(changes, { blockType: 'doctor-profile' })
        const doctors = changes.doctors as Record<string, unknown>[]
        expect(doctors[0]!.name).toBe('Doctor 1')
        expect(doctors[1]!.name).toBe('Dr. Lee')
    })

    it('TC-F01.PGRID-15 — GH-1621 audit: testimonials routes through sanitizeTestimonialItems (drops no-quote items)', () => {
        const changes = { testimonials: [{ quote: 'Great!', name: 'Bob' }, { quote: '' }] }
        normalizeChangesRequiredFields(changes, { blockType: 'testimonials' })
        expect(changes.testimonials).toEqual([{ quote: 'Great!', name: 'Bob' }])
    })

    it('TC-F01.PGRID-21 — GH-1621 code-review follow-up: property-card.properties[].title backfilled (Critical gap missed by the original audit)', () => {
        // property-card IS in BLOCK_IMAGE_SPEC (media-injector.ts, minCount:3) and
        // Pages.ts marks properties[].title required:true — the exact criterion the
        // GH-1621 audit itself used, but property-card was missed. Caught by
        // adversarial code review on PR #1629, fixed here.
        const changes = { properties: [{ title: 'Real Property' }, {}] }
        normalizeChangesRequiredFields(changes, { blockType: 'property-card' })
        const properties = changes.properties as Record<string, unknown>[]
        expect(properties[0]!.title).toBe('Real Property')
        expect(properties[1]!.title).toBe('Property 2')
    })

    it('TC-F01.PGRID-22 — faq keeps rows with unsafe-missing fields so publish can raise a friendly validation error, but still backfills safe alt fields', () => {
        const changes = {
            faqs: [
                { question: 'What time do you open?', answer: '9am daily' },
                { question: 'Incomplete question only' },
                { title: 'From title alt', answer: 'Resolved via alt field' },
            ],
        }
        normalizeChangesRequiredFields(changes, { blockType: 'faq' })
        expect(changes.faqs).toEqual([
            { question: 'What time do you open?', answer: '9am daily' },
            { question: 'Incomplete question only' },
            { title: 'From title alt', question: 'From title alt', answer: 'Resolved via alt field' },
        ])
    })

    it('TC-F01.PGRID-23 — pricing keeps incomplete plans/features for publish-time validation instead of dropping user content', () => {
        const changes = {
            plans: [
                { name: 'Starter', price: '29', features: [{ text: 'Feature A' }, { included: true }] },
                { name: 'Broken Plan' },
                { price: '99' },
            ],
        }
        normalizeChangesRequiredFields(changes, { blockType: 'pricing' })
        expect(changes.plans).toEqual([
            { name: 'Starter', price: '29', features: [{ text: 'Feature A' }, { included: true }] },
            { name: 'Broken Plan' },
            { price: '99' },
        ])
    })

    it('TC-F01.PGRID-24 — pricing-table keeps incomplete plans for publish-time validation', () => {
        const changes = { plans: [{ name: 'Pro', price: '59' }, { name: 'Missing price' }] }
        normalizeChangesRequiredFields(changes, { blockType: 'pricing-table' })
        expect(changes.plans).toEqual([{ name: 'Pro', price: '59' }, { name: 'Missing price' }])
    })

    it('TC-F01.PGRID-25 — navigation keeps broken links for validation, but still normalizes safe label fallbacks recursively', () => {
        const changes = {
            links: [
                { label: 'Home', url: '/' },
                { label: 'About' },
                { title: 'Alt label only', url: '/alt' },
                { label: 'Services', url: '/services', children: [{ label: 'Child', url: '/services/child' }, { label: 'Broken child' }] },
            ],
        }
        normalizeChangesRequiredFields(changes, { blockType: 'navigation' })
        expect(changes.links).toEqual([
            { label: 'Home', url: '/' },
            { label: 'About' },
            { title: 'Alt label only', label: 'Alt label only', url: '/alt' },
            { label: 'Services', url: '/services', children: [{ label: 'Child', url: '/services/child' }, { label: 'Broken child' }] },
        ])
    })
})

describe('[TC-F01.PGRID] coerceServiceItems()', () => {
    it('TC-F01.PGRID-09 — string shorthand becomes a fully-shaped service item', () => {
        const result = coerceServiceItems(['Haircut'])
        expect(result[0]).toEqual({ title: 'Haircut', icon: '⭐', description: '' })
    })

    it('TC-F01.PGRID-10 — preserves an existing non-empty description', () => {
        const result = coerceServiceItems([{ title: 'Massage', description: 'Full body' }])
        expect(result[0]!.description).toBe('Full body')
    })

    it('TC-F01.PGRID-12 — bare empty-string shorthand backfills to a generic title, not left blank', () => {
        // Regression guard: this is the exact defect class GH-1621 is about — an old
        // version of this code kept an empty-string item's title as '' verbatim.
        const result = coerceServiceItems([''])
        expect(result[0]!.title).toBe('Service 1')
    })
})

describe('[TC-F01.PGRID] sanitizeTestimonialItems()', () => {
    it('TC-F01.PGRID-16 — drops items with no quote (no safe fake-testimony fallback), backfills missing name', () => {
        const result = sanitizeTestimonialItems([
            { quote: 'Loved it', name: 'Alice' },
            { quote: '' }, // no quote — dropped entirely, not given a fake one
            { quote: 'Also great' }, // has quote, missing name — backfilled
        ])
        expect(result).toEqual([
            { quote: 'Loved it', name: 'Alice' },
            { quote: 'Also great', name: 'Customer 2' },
        ])
    })

    it('TC-F01.PGRID-17 — bare string item becomes the quote, not discarded (regression: was mistaken for an empty object and dropped)', () => {
        // The edit-block prompt gives no shape guidance for `testimonials` either
        // (same gap as portfolio-grid/TC-F01.PGRID-11) — a bare string AI response
        // is realistic and must keep its text as the quote, not vanish.
        const result = sanitizeTestimonialItems(['Fantastic team, delivered early!', { quote: 'Real' }])
        expect(result).toEqual([
            { quote: 'Fantastic team, delivered early!', name: 'Customer 1' },
            { quote: 'Real', name: 'Customer 2' },
        ])
    })

    it('TC-F01.PGRID-17b — non-object, non-string items (e.g. null/number) are dropped (no quote possible)', () => {
        const result = sanitizeTestimonialItems([null, 42, { quote: 'Real' }])
        expect(result).toEqual([{ quote: 'Real', name: 'Customer 1' }])
    })
})

describe('[TC-F01.PGRID] sanitizeBlocksRequiredFields()', () => {
    it('TC-F01.PGRID-18 — GH-1621 P0.2: walks a full page layout and backfills every vulnerable block, leaves others untouched', () => {
        const blocks = [
            { blockType: 'hero', headline: 'Welcome' },
            { blockType: 'portfolio-grid', projects: [{}] },
            { blockType: 'team', members: [{}] },
            { blockType: 'testimonials', testimonials: [{ quote: '' }, { quote: 'Nice' }] },
        ]
        const result = sanitizeBlocksRequiredFields(blocks)
        expect(result[0]).toEqual({ blockType: 'hero', headline: 'Welcome' })
        expect((result[1]!.projects as Record<string, unknown>[])[0]!.title).toBe('Project 1')
        expect((result[2]!.members as Record<string, unknown>[])[0]!.name).toBe('Team Member 1')
        expect(result[3]!.testimonials).toEqual([{ quote: 'Nice', name: 'Customer 1' }])
    })

    it('TC-F01.PGRID-19 — does not mutate the input array/blocks (returns copies)', () => {
        const original = [{ blockType: 'portfolio-grid', projects: [{}] }]
        const result = sanitizeBlocksRequiredFields(original)
        expect(original[0]!.projects).toEqual([{}]) // untouched
        expect(result).not.toBe(original)
        expect(result[0]).not.toBe(original[0])
    })

    it('TC-F01.PGRID-20 — skips blocks with no resolvable blockType (defensive, no crash)', () => {
        const blocks = [{ headline: 'No blockType here' }]
        expect(() => sanitizeBlocksRequiredFields(blocks)).not.toThrow()
        expect(sanitizeBlocksRequiredFields(blocks)).toEqual(blocks)
    })

    it('TC-F01.PGRID-26 — features/stats/about-cards keep invalid rows for validation while still applying safe backfills', () => {
        const result = sanitizeBlocksRequiredFields([
            { blockType: 'features', features: [{ title: 'Fast', description: 'Ships in one day' }, { title: 'Broken' }, { name: 'Alt title', body: 'Alt description' }] },
            { blockType: 'stats', stats: [{ value: '24/7', label: 'Support' }, { value: '99%' }, { value: '12', name: 'Years' }] },
            { blockType: 'about', layout: 'cards', stats: [{ value: '99%' }, { value: '12', title: 'Years' }] },
        ])
        expect(result).toEqual([
            { blockType: 'features', features: [{ title: 'Fast', description: 'Ships in one day' }, { title: 'Broken' }, { name: 'Alt title', body: 'Alt description', title: 'Alt title', description: 'Alt description' }] },
            { blockType: 'stats', stats: [{ value: '24/7', label: 'Support' }, { value: '99%' }, { value: '12', name: 'Years', label: 'Years' }] },
            { blockType: 'about', layout: 'cards', stats: [{ value: '99%' }, { value: '12', title: 'Years', label: 'Years' }] },
        ])
    })
})

describe('[TC-F01.PGRID] sanitizeSingleBlockRequiredFields()', () => {
    it('TC-F01.PGRID-27 — footer keeps incomplete columns/links for validation instead of silently deleting them', () => {
        const result = sanitizeSingleBlockRequiredFields({
            blockType: 'footer',
            columns: [
                { title: 'Company', links: [{ label: 'About', url: '/about' }, { label: 'Broken' }] },
                { links: [{ label: 'No title', url: '/x' }] },
            ],
        })
        expect(result).toEqual({
            blockType: 'footer',
            columns: [
                { title: 'Company', links: [{ label: 'About', url: '/about' }, { label: 'Broken' }] },
                { links: [{ label: 'No title', url: '/x' }] },
            ],
        })
    })

    it('TC-F01.PGRID-28 — step-process and social-proof normalize safe alt fields without deleting invalid rows', () => {
        const steps = sanitizeSingleBlockRequiredFields({
            blockType: 'step-process',
            steps: [{ heading: 'Step A', body: 'Do this' }, { title: 'Broken step' }],
        })
        expect(steps).toEqual({
            blockType: 'step-process',
            steps: [{ heading: 'Step A', body: 'Do this', title: 'Step A', description: 'Do this' }, { title: 'Broken step' }],
        })

        const reviews = sanitizeSingleBlockRequiredFields({
            blockType: 'social-proof',
            reviews: [{ name: 'Alice', quote: 'Amazing service' }, { author: 'Bob' }],
        })
        expect(reviews).toEqual({
            blockType: 'social-proof',
            reviews: [{ name: 'Alice', quote: 'Amazing service', author: 'Alice', content: 'Amazing service' }, { author: 'Bob' }],
        })
    })
})
