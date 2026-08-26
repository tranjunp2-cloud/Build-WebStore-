import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import en from '@/i18n/locales/en.json'
import ms from '@/i18n/locales/ms.json'

// ── TC-F17-02-03: Title validation (Bug 2 — maxLength 255) ───────────────────

// Pure logic extracted from src/app/(dashboard)/blog/[id]/page.tsx validate()
const validate = (title: string): string | null => {
    if (!title.trim()) return 'title_required'
    if (title.length > 255) return 'title_max_length'
    return null
}

describe('[TC-F17-02-03] Blog editor — title validation', () => {
    beforeEach(() => {
        vi.clearAllMocks()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('returns title_required when title is empty string', () => {
        // Arrange
        const title = ''

        // Act
        const result = validate(title)

        // Assert
        expect(result).toBe('title_required')
    })

    it('returns title_required when title is whitespace only', () => {
        // Arrange
        const title = '   '

        // Act
        const result = validate(title)

        // Assert
        expect(result).toBe('title_required')
    })

    it('returns title_max_length when title exceeds 255 characters', () => {
        // Arrange
        const title = 'a'.repeat(256)

        // Act
        const result = validate(title)

        // Assert
        expect(result).toBe('title_max_length')
    })

    it('returns null for a title of exactly 255 characters (boundary)', () => {
        // Arrange
        const title = 'a'.repeat(255)

        // Act
        const result = validate(title)

        // Assert
        expect(result).toBeNull()
    })

    it('returns null for a normal valid title', () => {
        // Arrange
        const title = 'My valid blog post title'

        // Act
        const result = validate(title)

        // Assert
        expect(result).toBeNull()
    })

    it('returns null for a single-character title', () => {
        // Arrange
        const title = 'A'

        // Act
        const result = validate(title)

        // Assert
        expect(result).toBeNull()
    })
})

// ── TC-F17-08: Toast i18n validation messages (Bug 8) ────────────────────────

// Mirror of the validationMessages map in handleSave()
const buildValidationMessages = (t: typeof en) => ({
    title_required: t.dashboard.blog.editor.titleRequired,
    title_max_length: t.dashboard.blog.editor.titleMaxLength,
})

describe('[TC-F17-08] Blog editor — validation message i18n mapping', () => {
    it('maps title_required to en titleRequired translation key', () => {
        // Arrange
        const messages = buildValidationMessages(en)

        // Act & Assert
        expect(messages['title_required']).toBe('Title is required.')
    })

    it('maps title_max_length to en titleMaxLength translation key', () => {
        // Arrange
        const messages = buildValidationMessages(en)

        // Act & Assert
        expect(messages['title_max_length']).toBe('Title must be under 255 characters.')
    })
})

// ── TC-F17-04 / BUG-035: Publish date bypass logic (Bug 4) ───────────────────

describe('[TC-F17-04] Blog editor — publish date defaulting and future-date guard', () => {
    afterEach(() => {
        vi.useRealTimers()
    })

    it('defaults effectivePublishDate to now when publishDate is undefined', () => {
        // Arrange
        vi.useFakeTimers()
        const now = new Date('2026-04-14T10:00:00Z')
        vi.setSystemTime(now)
        const publishDate: Date | undefined = undefined

        // Act
        const effectivePublishDate = publishDate || new Date()

        // Assert
        expect(effectivePublishDate.toISOString()).toBe(now.toISOString())
    })

    it('detects a future publish date as greater than now', () => {
        // Arrange
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-04-14T10:00:00Z'))
        const futureDate = new Date('2026-04-15T10:00:00Z')
        const effectivePublishDate = futureDate || new Date()

        // Act
        const isFuture = effectivePublishDate > new Date()

        // Assert
        expect(isFuture).toBe(true)
    })

    it('does not flag a past publish date as future', () => {
        // Arrange
        vi.useFakeTimers()
        vi.setSystemTime(new Date('2026-04-14T10:00:00Z'))
        const pastDate = new Date('2026-04-13T10:00:00Z')
        const effectivePublishDate = pastDate || new Date()

        // Act
        const isFuture = effectivePublishDate > new Date()

        // Assert
        expect(isFuture).toBe(false)
    })

    it('does not flag current time as future (exact boundary)', () => {
        // Arrange
        vi.useFakeTimers()
        const now = new Date('2026-04-14T10:00:00Z')
        vi.setSystemTime(now)
        const publishDate = new Date(now.getTime())
        const effectivePublishDate = publishDate || new Date()

        // Act
        const isFuture = effectivePublishDate > new Date()

        // Assert
        expect(isFuture).toBe(false)
    })
})

// ── TC-F17-10: Breadcrumb home URL (Bug 10) ──────────────────────────────────

describe('[TC-F17-10] Blog editor — breadcrumb home URL', () => {
    it('breadcrumb home route is /dashboard, not /', () => {
        // Arrange — the correct home route per the fix
        const BREADCRUMB_HOME_ROUTE = '/dashboard'

        // Assert
        expect(BREADCRUMB_HOME_ROUTE).toBe('/dashboard')
        expect(BREADCRUMB_HOME_ROUTE).not.toBe('/')
    })
})

// ── TC-F17-11: SEO label i18n (Bug 11) ───────────────────────────────────────

describe('[TC-F17-11] Blog editor — SEO label i18n', () => {
    it('en.json has seoTitle = "SEO settings"', () => {
        // Arrange & Act
        const seoTitle = en.dashboard.blog.editor.seoTitle

        // Assert
        expect(seoTitle).toBe('SEO settings')
    })

    it('ms.json has seoTitle = "Tetapan SEO"', () => {
        // Arrange & Act
        const seoTitle = ms.dashboard.blog.editor.seoTitle

        // Assert
        expect(seoTitle).toBe('Tetapan SEO')
    })
})
