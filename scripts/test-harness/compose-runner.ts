/**
 * Compose runner — invokes composer for one fixture and normalises output
 * into HarnessResult. Never throws (wraps errors into composerError field).
 */

import {
  composeFromBlueprint,
  composeTemplate,
  type ComposerInput,
} from '@/lib/ai/template-composer'
import {
  TEMPLATE_PRESETS,
  TEMPLATE_DEFINITIONS,
} from '@/lib/ai/template-definitions'
import type { Fixture, HarnessResult, HarnessBlock } from './types'

export function invokeComposer(fixture: Fixture): HarnessResult {
  const startedAt = Date.now()

  try {
    if (fixture.source === 'blueprint') {
      if (fixture.presetIndex == null) {
        throw new Error(`blueprint fixture ${fixture.id} missing presetIndex`)
      }
      const preset = TEMPLATE_PRESETS[fixture.presetIndex]
      if (!preset) {
        throw new Error(`preset index ${fixture.presetIndex} out of range`)
      }
      const seed = composeFromBlueprint(preset, fixture.compositionSeed)
      return normalise(fixture, seed, startedAt)
    }

    // legacy path — find a TEMPLATE_DEFINITIONS matching category+variant
    const legacyDef = TEMPLATE_DEFINITIONS.find(
      (d) => d.category === fixture.category && d.variant === fixture.variant,
    )
    if (!legacyDef) {
      throw new Error(
        `no legacy definition for ${fixture.category}/${fixture.variant}`,
      )
    }
    const input: ComposerInput = {
      category: legacyDef.category,
      businessIndex: legacyDef.businessIndex,
      variant: legacyDef.variant,
      themePreset: legacyDef.themePreset,
      compositionSeed: fixture.compositionSeed,
    }
    const seed = composeTemplate(input)
    return normalise(fixture, seed, startedAt)
  } catch (err) {
    return {
      fixture,
      blocks: [],
      theme: {},
      pageCount: 0,
      composerError: err instanceof Error ? err.message : String(err),
      durationMs: Date.now() - startedAt,
    }
  }
}

function normalise(
  fixture: Fixture,
  seed: ReturnType<typeof composeFromBlueprint>,
  startedAt: number,
): HarnessResult {
  const homepage =
    seed.pages.find((p) => /home/i.test(p.slug) || /home/i.test(p.title)) ??
    seed.pages[0]

  const blocks: HarnessBlock[] = (homepage?.layout ?? []).map((b: any) => {
    const { blockType, type, variant, ...rest } = b
    return {
      blockType: blockType ?? type ?? 'unknown',
      variant,
      data: rest,
    }
  })

  return {
    fixture,
    blocks,
    theme: (seed as any).theme ?? {},
    pageCount: seed.pages.length,
    durationMs: Date.now() - startedAt,
  }
}
