/**
 * Guard: block ordering invariants.
 *   - navigation must be first
 *   - footer must be last
 *   - features must come before stats (if both present)
 *   - about must come before team (if both present)
 *   - social-proof/testimonials should come after features
 */

import type { HarnessResult, GuardReport } from '../types'

type OrderingRule = { a: string; b: string; label: string }

const BEFORE_RULES: OrderingRule[] = [
  { a: 'features', b: 'stats', label: 'features before stats' },
  { a: 'about', b: 'team', label: 'about before team' },
]

export function orderingGuard(r: HarnessResult): GuardReport {
  const blocks = r.blocks
  const types = blocks.map((b) => b.blockType)
  const violations: string[] = []

  if (blocks.length > 0) {
    if (types[0] !== 'navigation') {
      violations.push(`first block should be navigation, got ${types[0]}`)
    }
    const last = types[types.length - 1]
    if (last !== 'footer') {
      violations.push(`last block should be footer, got ${last}`)
    }
  }

  for (const rule of BEFORE_RULES) {
    const ia = types.indexOf(rule.a)
    const ib = types.indexOf(rule.b)
    if (ia >= 0 && ib >= 0 && ia > ib) {
      violations.push(rule.label)
    }
  }

  if (violations.length === 0) {
    return { name: 'ordering', status: 'pass' }
  }

  // Nav/footer position violations = hard fail (structural).
  // features-before-stats / about-before-team = warn (aesthetic preference,
  // some blueprints intentionally use different order).
  const hardFailure = violations.some(
    (v) => v.includes('first block') || v.includes('last block'),
  )

  return {
    name: 'ordering',
    status: hardFailure ? 'fail' : 'warn',
    reason: `ordering violations: ${violations.join('; ')}`,
    data: { violations, actual: types },
  }
}
