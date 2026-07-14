/**
 * Unit Tests: normalizeChangesRequiredFields() / coerceServiceItems()
 * TC-ID: TC-F01.PGRID — Payload-required array-item title backfill (GH-1621)
 * Convention: docs/TEST_CONVENTION.md
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { normalizeChangesRequiredFields, coerceServiceItems, sanitizeTestimonialItems, sanitizeBlocksRequiredFields } from '@/lib/ai/normalize-required-titles'

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

    it('TC-F01.PGRID-17 — non-object items are dropped (no quote possible)', () => {
        const result = sanitizeTestimonialItems(['just a string', { quote: 'Real' }])
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
})
