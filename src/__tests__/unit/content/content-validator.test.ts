import { describe, it, expect } from 'vitest'

import { validateCategoryContent, hasRMPricing } from '@/lib/ai/content/validator'
import { categoryMap } from '@/lib/ai/content'
import type { CategoryContent } from '@/lib/ai/content/types'

// ── TC-S3-009: Content validator ─────────────────────────────────────────

describe('[TC-S3-009] validateCategoryContent', () => {
  it('validates restaurant content and returns a result object', () => {
    // Arrange
    const content = categoryMap['restaurant']!

    // Act
    const result = validateCategoryContent(content)

    // Assert — result has expected shape
    expect(result).toHaveProperty('valid')
    expect(result).toHaveProperty('errors')
    expect(Array.isArray(result.errors)).toBe(true)
  })

  it('all 11 category content files return result with valid shape', () => {
    for (const [, content] of Object.entries(categoryMap)) {
      // Act
      const result = validateCategoryContent(content)

      // Assert — no count-related errors (businesses >= 4, testimonials >= 3, faq >= 3)
      expect(result.errors.filter((e) => e.includes('at least 4 businesses'))).toHaveLength(0)
      expect(result.errors.filter((e) => e.includes('at least 3 testimonials'))).toHaveLength(0)
      expect(result.errors.filter((e) => e.includes('at least 3 FAQ'))).toHaveLength(0)
      // Locale is correct for all
      expect(result.errors.filter((e) => e.includes('Locale'))).toHaveLength(0)
      // No placeholder text
      expect(result.errors.filter((e) => e.includes('placeholder text'))).toHaveLength(0)
      // No $ currency
      expect(result.errors.filter((e) => e.includes('$ currency'))).toHaveLength(0)
    }
  })

  it('content with too few businesses fails', () => {
    // Arrange
    const badContent: CategoryContent = {
      category: 'test',
      locale: 'en-MY',
      businesses: [
        {
          name: 'Test Biz',
          tagline: 'Test tagline',
          description: 'Test description',
          address: 'No. 1, Jalan Test, KL',
          phone: '+60 3-1234 5678',
          email: 'test@test.com',
          heroHeadline: 'Test',
          heroSubheadline: 'Test sub',
        },
      ],
      testimonials: [
        { name: 'A', rating: 5, quote: 'Great service!' },
        { name: 'B', rating: 4, quote: 'Good experience.' },
        { name: 'C', rating: 5, quote: 'Highly recommended.' },
      ],
      faqItems: [
        { question: 'Q1?', answer: 'A1.' },
        { question: 'Q2?', answer: 'A2.' },
        { question: 'Q3?', answer: 'A3.' },
      ],
      industryBlocks: [],
    }

    // Act
    const result = validateCategoryContent(badContent)

    // Assert
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('at least 4 businesses'))).toBe(true)
  })

  it('content with non-+60 phone fails', () => {
    // Arrange
    const badContent: CategoryContent = {
      category: 'test',
      locale: 'en-MY',
      businesses: [
        { name: 'Biz 1', tagline: 'T', description: 'D', address: 'No. 1, Jalan Test', phone: '+1 555-1234', email: 'a@a.com', heroHeadline: 'H', heroSubheadline: 'S' },
        { name: 'Biz 2', tagline: 'T', description: 'D', address: 'No. 2, Jalan Test', phone: '+60 3-1234 5678', email: 'b@b.com', heroHeadline: 'H', heroSubheadline: 'S' },
        { name: 'Biz 3', tagline: 'T', description: 'D', address: 'No. 3, Jalan Test', phone: '+60 3-2345 6789', email: 'c@c.com', heroHeadline: 'H', heroSubheadline: 'S' },
        { name: 'Biz 4', tagline: 'T', description: 'D', address: 'No. 4, Jalan Test', phone: '+60 3-3456 7890', email: 'd@d.com', heroHeadline: 'H', heroSubheadline: 'S' },
      ],
      testimonials: [
        { name: 'A', rating: 5, quote: 'Great!' },
        { name: 'B', rating: 4, quote: 'Good.' },
        { name: 'C', rating: 5, quote: 'Nice.' },
      ],
      faqItems: [
        { question: 'Q1?', answer: 'A1.' },
        { question: 'Q2?', answer: 'A2.' },
        { question: 'Q3?', answer: 'A3.' },
      ],
      industryBlocks: [],
    }

    // Act
    const result = validateCategoryContent(badContent)

    // Assert
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('+60 format'))).toBe(true)
  })

  it('content with Lorem ipsum fails', () => {
    // Arrange
    const badContent: CategoryContent = {
      category: 'test',
      locale: 'en-MY',
      businesses: [
        { name: 'Biz 1', tagline: 'Lorem ipsum dolor sit amet', description: 'D', address: 'No. 1, Jalan Test', phone: '+60 3-1234 5678', email: 'a@a.com', heroHeadline: 'H', heroSubheadline: 'S' },
        { name: 'Biz 2', tagline: 'T', description: 'D', address: 'No. 2, Jalan Test', phone: '+60 3-2345 6789', email: 'b@b.com', heroHeadline: 'H', heroSubheadline: 'S' },
        { name: 'Biz 3', tagline: 'T', description: 'D', address: 'No. 3, Jalan Test', phone: '+60 3-3456 7890', email: 'c@c.com', heroHeadline: 'H', heroSubheadline: 'S' },
        { name: 'Biz 4', tagline: 'T', description: 'D', address: 'No. 4, Jalan Test', phone: '+60 3-4567 8901', email: 'd@d.com', heroHeadline: 'H', heroSubheadline: 'S' },
      ],
      testimonials: [
        { name: 'A', rating: 5, quote: 'Great!' },
        { name: 'B', rating: 4, quote: 'Good.' },
        { name: 'C', rating: 5, quote: 'Nice.' },
      ],
      faqItems: [
        { question: 'Q1?', answer: 'A1.' },
        { question: 'Q2?', answer: 'A2.' },
        { question: 'Q3?', answer: 'A3.' },
      ],
      industryBlocks: [],
    }

    // Act
    const result = validateCategoryContent(badContent)

    // Assert
    expect(result.valid).toBe(false)
    expect(result.errors.some((e) => e.includes('placeholder text'))).toBe(true)
  })
})

describe('[TC-S3-009] hasRMPricing utility', () => {
  it('detects RM pricing in text', () => {
    // Act & Assert
    expect(hasRMPricing('Our nasi lemak costs RM 12')).toBe(true)
    expect(hasRMPricing('Price: RM5 only')).toBe(true)
  })

  it('returns false for non-RM text', () => {
    // Act & Assert
    expect(hasRMPricing('Price: $12 USD')).toBe(false)
    expect(hasRMPricing('No prices here')).toBe(false)
  })
})
