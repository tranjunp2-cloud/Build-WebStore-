/**
 * Guard: zero blocks use variants in BROKEN_VARIANTS.
 * If composer picks a broken variant, the render will be wrong/missing.
 */

import type { HarnessResult, GuardReport } from '../types'
// Single source of truth: src/lib/ai/template-composer.ts
import { BROKEN_VARIANTS } from '../../../src/lib/ai/template-composer'

export function variantWhitelistGuard(r: HarnessResult): GuardReport {
  const offenders: Array<{ blockType: string; variant: string; index: number }> = []

  r.blocks.forEach((b, index) => {
    const broken = BROKEN_VARIANTS[b.blockType] ?? []
    if (b.variant && broken.includes(b.variant)) {
      offenders.push({ blockType: b.blockType, variant: b.variant, index })
    }
  })

  if (offenders.length === 0) {
    return { name: 'variant-whitelist', status: 'pass' }
  }

  return {
    name: 'variant-whitelist',
    status: 'fail',
    reason: `${offenders.length} block(s) using broken variants: ${offenders
      .map((o) => `${o.blockType}:${o.variant}`)
      .join(', ')}`,
    data: { offenders, broken: BROKEN_VARIANTS },
  }
}
