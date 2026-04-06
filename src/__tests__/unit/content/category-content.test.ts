import { describe, it, expect } from 'vitest'

import { categoryMap, getCategoryContent, getAllCategories } from '@/lib/ai/content'

// ── TC-S3-009: Category content files — 11 categories with MY data ───────

const ALL_CATEGORIES = [
  'restaurant', 'ecommerce', 'beauty', 'tech', 'health',
  'education', 'realestate', 'fitness', 'creative', 'business', 'fnb',
]

const MY_PHONE_REGEX = /^\+60[\s]?\d[\d\s-]{7,}/
const MY_ADDRESS_KEYWORDS = [
  'Jalan', 'Lorong', 'Taman', 'Persiaran', 'Lebuh',
  'Kampung', 'Bukit', 'Bandar', 'Desa', 'Seri', 'Sri',
  'Plaza', 'Menara', 'Wisma', 'Kompleks', 'No.',
  'Seksyen', 'Level',
]

describe('[TC-S3-009] categoryMap structure', () => {
  it('has exactly 11 entries', () => {
    // Assert
    expect(Object.keys(categoryMap)).toHaveLength(11)
  })

  it('contains all expected categories', () => {
    // Assert
    for (const cat of ALL_CATEGORIES) {
      expect(categoryMap).toHaveProperty(cat)
    }
  })

  it('getAllCategories returns 11 categories', () => {
    // Act
    const categories = getAllCategories()

    // Assert
    expect(categories).toHaveLength(11)
    for (const cat of ALL_CATEGORIES) {
      expect(categories).toContain(cat)
    }
  })
})

describe('[TC-S3-009] getCategoryContent', () => {
  it('returns valid data for restaurant', () => {
    // Act
    const content = getCategoryContent('restaurant')

    // Assert
    expect(content).toBeDefined()
    expect(content!.category).toBe('restaurant')
    expect(content!.locale).toBe('en-MY')
    expect(content!.businesses.length).toBeGreaterThanOrEqual(4)
  })

  it('returns undefined for nonexistent category', () => {
    // Act
    const content = getCategoryContent('nonexistent')

    // Assert
    expect(content).toBeUndefined()
  })
})

describe('[TC-S3-009] Each category has minimum content', () => {
  for (const cat of ALL_CATEGORIES) {
    describe(`${cat}`, () => {
      it('has at least 4 businesses', () => {
        // Arrange
        const content = categoryMap[cat]!

        // Assert
        expect(content.businesses.length).toBeGreaterThanOrEqual(4)
      })

      it('has at least 3 testimonials', () => {
        // Arrange
        const content = categoryMap[cat]!

        // Assert
        expect(content.testimonials.length).toBeGreaterThanOrEqual(3)
      })

      it('has at least 3 faqItems', () => {
        // Arrange
        const content = categoryMap[cat]!

        // Assert
        expect(content.faqItems.length).toBeGreaterThanOrEqual(3)
      })

      it('has locale en-MY', () => {
        // Arrange
        const content = categoryMap[cat]!

        // Assert
        expect(content.locale).toBe('en-MY')
      })
    })
  }
})

describe('[TC-S3-009] Business data quality', () => {
  for (const cat of ALL_CATEGORIES) {
    describe(`${cat} businesses`, () => {
      it('all business names are non-empty', () => {
        // Arrange
        const content = categoryMap[cat]!

        // Assert
        for (const biz of content.businesses) {
          expect(biz.name.trim().length).toBeGreaterThan(0)
        }
      })

      it('all business phones match +60 pattern', () => {
        // Arrange
        const content = categoryMap[cat]!

        // Assert
        for (const biz of content.businesses) {
          expect(biz.phone).toMatch(MY_PHONE_REGEX)
        }
      })

      it('all business addresses contain Malaysian keywords', () => {
        // Arrange
        const content = categoryMap[cat]!

        // Assert
        for (const biz of content.businesses) {
          const hasKeyword = MY_ADDRESS_KEYWORDS.some((kw) => biz.address.includes(kw))
          expect(hasKeyword).toBe(true)
        }
      })
    })
  }
})
