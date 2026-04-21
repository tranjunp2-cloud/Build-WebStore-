/**
 * Guard: every category signature block (from fixture.expectedSignatureBlocks)
 * must be present in the homepage. Sourced from CATEGORY_REQUIREMENTS.mandatoryBlocks
 * at matrix-build time (post Plan 2253 cleanup that removed CATEGORY_DNA).
 * This is THE Ben-Ben guard — restaurant without menu-display/booking-widget/gallery
 * is the exact class we want to fail loudly.
 */

import type { HarnessResult, GuardReport } from '../types'

export function signatureBlocksGuard(r: HarnessResult): GuardReport {
  const present = new Set(r.blocks.map((b) => b.blockType))
  const missing = r.fixture.expectedSignatureBlocks.filter(
    (sig) => !present.has(sig),
  )

  if (missing.length === 0) {
    return {
      name: 'signature-blocks',
      status: 'pass',
      data: { present: r.fixture.expectedSignatureBlocks },
    }
  }

  // Partial = warn (some category signature blocks are optional-ish)
  // All missing = fail (the Ben-Ben case)
  const allMissing = missing.length === r.fixture.expectedSignatureBlocks.length
  return {
    name: 'signature-blocks',
    status: allMissing ? 'fail' : 'warn',
    reason: allMissing
      ? `ALL signature blocks missing for ${r.fixture.category} — ${missing.join(', ')} (Ben-Ben!)`
      : `${missing.length}/${r.fixture.expectedSignatureBlocks.length} signature blocks missing: ${missing.join(', ')}`,
    data: {
      missing,
      expected: r.fixture.expectedSignatureBlocks,
      actual: r.blocks.map((b) => b.blockType),
    },
  }
}
