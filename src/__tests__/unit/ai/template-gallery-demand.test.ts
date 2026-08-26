import { describe, expect, it } from 'vitest'
import {
  getTemplateGalleryDemand,
  selectTemplatePreset,
} from '@/lib/ai/template-definitions'

describe('template gallery demand', () => {
  it('uses the same deterministic preset selection as the composer', () => {
    expect(selectTemplatePreset('fnb', 2)?.id).toBe('fnb-cafe-noir')
    expect(getTemplateGalleryDemand('fnb', 2)).toEqual({
      presetId: 'fnb-cafe-noir',
      blockCount: 4,
      imageCount: 24,
    })
  })

  it('does not reserve gallery images for a preset without gallery blocks', () => {
    expect(getTemplateGalleryDemand('tech', 0)).toEqual({
      presetId: 'tech-cyber-saas',
      blockCount: 0,
      imageCount: 0,
    })
  })

  it('returns null when the category has no template preset', () => {
    expect(getTemplateGalleryDemand('unknown-industry', 0)).toBeNull()
  })
})
