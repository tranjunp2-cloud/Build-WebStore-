import { describe, it, expect, beforeEach } from 'vitest'

import { blockRegistry } from '@/blocks/registry'
import { BLOCK_TYPES } from '@/blocks/types'

import { MenuDisplayConfigSchema, menuDisplayMeta } from '@/blocks/menu-display/config'
import { BookingWidgetConfigSchema, bookingWidgetMeta } from '@/blocks/booking-widget/config'
import { ClassScheduleConfigSchema, classScheduleMeta } from '@/blocks/class-schedule/config'
import { ReviewCardsConfigSchema, reviewCardsMeta } from '@/blocks/review-cards/config'
import { VideoShowcaseConfigSchema, videoShowcaseMeta } from '@/blocks/video-showcase/config'
import { DoctorProfileConfigSchema, doctorProfileMeta } from '@/blocks/doctor-profile/config'
import { PropertyCardConfigSchema, propertyCardMeta } from '@/blocks/property-card/config'
import { ProductQuickViewConfigSchema, productQuickViewMeta } from '@/blocks/product-quick-view/config'

// ── TC-S3-001–008 + TC-S3-016: Industry block configs & registry ─────────

const INDUSTRY_BLOCKS = [
  {
    type: 'menu-display',
    schema: MenuDisplayConfigSchema,
    meta: menuDisplayMeta,
    variants: ['tabs', 'photo-grid', 'accordion'],
    defaultVariant: 'tabs',
  },
  {
    type: 'booking-widget',
    schema: BookingWidgetConfigSchema,
    meta: bookingWidgetMeta,
    variants: ['inline', 'sidebar', 'modal-trigger'],
    defaultVariant: 'inline',
  },
  {
    type: 'class-schedule',
    schema: ClassScheduleConfigSchema,
    meta: classScheduleMeta,
    variants: ['grid', 'list', 'cards'],
    defaultVariant: 'grid',
  },
  {
    type: 'review-cards',
    schema: ReviewCardsConfigSchema,
    meta: reviewCardsMeta,
    variants: ['grid', 'carousel', 'masonry'],
    defaultVariant: 'grid',
  },
  {
    type: 'video-showcase',
    schema: VideoShowcaseConfigSchema,
    meta: videoShowcaseMeta,
    variants: ['grid', 'featured', 'fullwidth'],
    defaultVariant: 'grid',
  },
  {
    type: 'doctor-profile',
    schema: DoctorProfileConfigSchema,
    meta: doctorProfileMeta,
    variants: ['cards', 'detailed', 'list'],
    defaultVariant: 'cards',
  },
  {
    type: 'property-card',
    schema: PropertyCardConfigSchema,
    meta: propertyCardMeta,
    variants: ['grid', 'list', 'featured'],
    defaultVariant: 'grid',
  },
  {
    type: 'product-quick-view',
    schema: ProductQuickViewConfigSchema,
    meta: productQuickViewMeta,
    variants: ['grid', 'carousel', 'minimal'],
    defaultVariant: 'grid',
  },
] as const

describe('[TC-S3-001–008] Industry block configs — Zod schema validation', () => {
  for (const block of INDUSTRY_BLOCKS) {
    describe(`${block.type}`, () => {
      it('validates a minimal valid config with defaults', () => {
        // Arrange
        const input = { blockType: block.type, headline: 'Test Headline' }

        // Act
        const result = block.schema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
      })

      it(`has exactly ${block.variants.length} variants`, () => {
        // Assert
        expect(block.meta.variants).toHaveLength(block.variants.length)
        expect(block.meta.variants).toEqual(expect.arrayContaining(block.variants))
      })

      it(`defaults to variant '${block.defaultVariant}'`, () => {
        // Arrange
        const input = { blockType: block.type, headline: 'Test' }

        // Act
        const result = block.schema.safeParse(input)

        // Assert
        expect(result.success).toBe(true)
        if (result.success) {
          expect(result.data.variant).toBe(block.defaultVariant)
        }
      })

      it('rejects invalid variant name', () => {
        // Arrange
        const input = { blockType: block.type, headline: 'Test', variant: 'nonexistent-variant' }

        // Act
        const result = block.schema.safeParse(input)

        // Assert
        expect(result.success).toBe(false)
      })

      for (const variant of block.variants) {
        it(`accepts variant '${variant}'`, () => {
          // Arrange
          const input = { blockType: block.type, headline: 'Test', variant }

          // Act
          const result = block.schema.safeParse(input)

          // Assert
          expect(result.success).toBe(true)
        })
      }
    })
  }
})

// ── TC-S3-016: BLOCK_TYPES registry completeness ────────────────────────

describe('[TC-S3-016] BLOCK_TYPES includes all 8 industry blocks', () => {
  const INDUSTRY_BLOCK_TYPES = [
    'menu-display',
    'booking-widget',
    'class-schedule',
    'review-cards',
    'video-showcase',
    'doctor-profile',
    'property-card',
    'product-quick-view',
  ]

  for (const blockType of INDUSTRY_BLOCK_TYPES) {
    it(`BLOCK_TYPES includes '${blockType}'`, () => {
      // Assert
      expect(BLOCK_TYPES).toContain(blockType)
    })
  }
})

describe('[TC-S3-016] blockRegistry includes all 8 industry blocks', () => {
  const INDUSTRY_BLOCK_TYPES = [
    'menu-display',
    'booking-widget',
    'class-schedule',
    'review-cards',
    'video-showcase',
    'doctor-profile',
    'property-card',
    'product-quick-view',
  ]

  for (const blockType of INDUSTRY_BLOCK_TYPES) {
    it(`blockRegistry.has('${blockType}') returns true`, () => {
      // Assert
      expect(blockRegistry.has(blockType)).toBe(true)
    })
  }

  it('each industry block has a schema in registry', () => {
    for (const blockType of INDUSTRY_BLOCK_TYPES) {
      // Act
      const schema = blockRegistry.getSchema(blockType)

      // Assert
      expect(schema).not.toBeNull()
    }
  })

  it('each industry block has meta in registry', () => {
    for (const blockType of INDUSTRY_BLOCK_TYPES) {
      // Act
      const meta = blockRegistry.getBlockMeta(blockType)

      // Assert
      expect(meta).not.toBeNull()
      expect(meta!.type).toBe(blockType)
    }
  })
})
