/**
 * TC-F01-PR-01..04 — Payload transient error retry wrapper.
 * Plan: plans/260415-1745-ai-gen-flow-fix-v2/reports/fix-500-debug.md
 *
 * Verifies classifyTransientError + withPayloadRetry for the save route
 * deadlock/FK violation bug (~180 hits per 24h on /api/sites save).
 */

import { describe, it, expect, vi } from 'vitest'
import { classifyTransientError, withPayloadRetry } from '@/lib/payload-retry'

describe('classifyTransientError', () => {
    describe('TC-F01-PR-01: detects transient errors', () => {
        it('detects deadlock', () => {
            const err = new Error('Failed query: UPDATE _pages_v SET latest = false... deadlock detected')
            expect(classifyTransientError(err)).toBe('deadlock')
        })

        it('detects _pages_v_blocks_* parent_id_fk violation', () => {
            const err = new Error(
                'insert or update on table "_pages_v_blocks_navigation_links" violates foreign key constraint "_pages_v_blocks_navigation_links_parent_id_fk"',
            )
            expect(classifyTransientError(err)).toBe('fk-violation')
        })

        it('detects pages_blocks_* parent_id_fk violation', () => {
            const err = new Error(
                'insert or update on table "pages_blocks_about" violates foreign key constraint "pages_blocks_about_parent_id_fk"',
            )
            expect(classifyTransientError(err)).toBe('fk-violation')
        })

        it('detects image FK violation in nested block table', () => {
            const err = new Error(
                'insert or update on table "pages_blocks_testimonials_testimonials" violates foreign key constraint "pages_blocks_testimonials_testimonials_avatar_id"',
            )
            expect(classifyTransientError(err)).toBe('fk-violation')
        })

        it('detects logo FK violation in nested block table', () => {
            const err = new Error(
                'insert on "pages_blocks_clients_logos" violates foreign key constraint "pages_blocks_clients_logos_image_id"',
            )
            expect(classifyTransientError(err)).toBe('fk-violation')
        })

        it('does not match image_id without FK violation keyword', () => {
            const err = new Error('pages_blocks_hero image_id is null')
            expect(classifyTransientError(err)).toBe(null)
        })

        it('detects TypeError reading title (post-deadlock symptom)', () => {
            const err = new TypeError("Cannot read properties of undefined (reading 'title')")
            expect(classifyTransientError(err)).toBe('type-error-title')
        })
    })

    describe('TC-F01-PR-02: ignores non-transient errors', () => {
        it('returns null for unknown errors', () => {
            expect(classifyTransientError(new Error('random error'))).toBe(null)
            expect(classifyTransientError(new Error('ValidationError: missing field'))).toBe(null)
        })

        it('returns null for null/undefined/primitives', () => {
            expect(classifyTransientError(null)).toBe(null)
            expect(classifyTransientError(undefined)).toBe(null)
            expect(classifyTransientError('string error')).toBe(null)
            expect(classifyTransientError(42)).toBe(null)
        })

        it('TypeError without title keyword is NOT classified', () => {
            expect(classifyTransientError(new TypeError('Cannot read properties of null'))).toBe(null)
        })
    })
})

describe('withPayloadRetry', () => {
    describe('TC-F01-PR-03: retries transient errors', () => {
        it('retries on deadlock then succeeds', async () => {
            let attempts = 0
            const fn = vi.fn(async () => {
                attempts++
                if (attempts < 2) throw new Error('Failed query: deadlock detected')
                return { id: 42 }
            })

            const result = await withPayloadRetry(fn, { baseDelayMs: 1 })
            expect(result).toEqual({ id: 42 })
            expect(fn).toHaveBeenCalledTimes(2)
        })

        it('retries on FK violation then succeeds', async () => {
            let attempts = 0
            const fn = vi.fn(async () => {
                attempts++
                if (attempts < 3) {
                    throw new Error(
                        'insert or update on table "_pages_v_blocks_hero" violates foreign key constraint "_pages_v_blocks_hero_parent_id_fk"',
                    )
                }
                return { saved: true }
            })

            const result = await withPayloadRetry(fn, { baseDelayMs: 1, maxRetries: 3 })
            expect(result).toEqual({ saved: true })
            expect(fn).toHaveBeenCalledTimes(3)
        })

        it('retries on TypeError reading title', async () => {
            let attempts = 0
            const fn = vi.fn(async () => {
                attempts++
                if (attempts === 1) throw new TypeError("Cannot read properties of undefined (reading 'title')")
                return 'ok'
            })

            const result = await withPayloadRetry(fn, { baseDelayMs: 1 })
            expect(result).toBe('ok')
            expect(fn).toHaveBeenCalledTimes(2)
        })

        it('invokes onRetry callback with attempt + kind + error', async () => {
            const onRetry = vi.fn()
            const fn = vi.fn(async () => {
                throw new Error('deadlock detected')
            })

            await expect(withPayloadRetry(fn, { baseDelayMs: 1, maxRetries: 2, onRetry })).rejects.toThrow()
            expect(onRetry).toHaveBeenCalledTimes(2)
            expect(onRetry).toHaveBeenNthCalledWith(1, 1, 'deadlock', expect.any(Error))
            expect(onRetry).toHaveBeenNthCalledWith(2, 2, 'deadlock', expect.any(Error))
        })
    })

    describe('TC-F01-PR-04: fails fast on non-transient errors', () => {
        it('does NOT retry on validation errors', async () => {
            const fn = vi.fn(async () => {
                throw new Error('ValidationError: siteType invalid')
            })

            await expect(withPayloadRetry(fn, { baseDelayMs: 1 })).rejects.toThrow('ValidationError')
            expect(fn).toHaveBeenCalledTimes(1)
        })

        it('throws after exhausting retries on persistent deadlock', async () => {
            const fn = vi.fn(async () => {
                throw new Error('Failed query: deadlock detected')
            })

            await expect(withPayloadRetry(fn, { baseDelayMs: 1, maxRetries: 2 })).rejects.toThrow('deadlock')
            expect(fn).toHaveBeenCalledTimes(3) // initial + 2 retries
        })

        it('returns on first success without retry', async () => {
            const fn = vi.fn(async () => 'instant-success')
            const result = await withPayloadRetry(fn, { baseDelayMs: 1 })
            expect(result).toBe('instant-success')
            expect(fn).toHaveBeenCalledTimes(1)
        })
    })
})
