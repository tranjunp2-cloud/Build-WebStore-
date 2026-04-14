/**
 * Orchestrator — runs all per-fixture guards and aggregates results.
 * Cross-fixture variety-metrics is handled separately in the CLI.
 */

import type { HarnessResult, GuardReport, GuardStatus } from '../types'
import { blockCountGuard } from './block-count'
import { signatureBlocksGuard } from './signature-blocks'
import { noEmptyDataGuard } from './no-empty-data'
import { orderingGuard } from './ordering'
import { variantWhitelistGuard } from './variant-whitelist'

export type PerFixtureGuards = {
  fixtureId: string
  category: string
  overallStatus: GuardStatus
  guards: GuardReport[]
}

export function runAllGuards(r: HarnessResult): PerFixtureGuards {
  // Composer error = immediate FAIL, skip rest
  if (r.composerError) {
    return {
      fixtureId: r.fixture.id,
      category: r.fixture.category,
      overallStatus: 'fail',
      guards: [
        {
          name: 'composer',
          status: 'fail',
          reason: `composer threw: ${r.composerError}`,
        },
      ],
    }
  }

  const guards: GuardReport[] = [
    blockCountGuard(r),
    signatureBlocksGuard(r),
    noEmptyDataGuard(r),
    orderingGuard(r),
    variantWhitelistGuard(r),
  ]

  const overallStatus: GuardStatus = guards.some((g) => g.status === 'fail')
    ? 'fail'
    : guards.some((g) => g.status === 'warn')
    ? 'warn'
    : 'pass'

  return {
    fixtureId: r.fixture.id,
    category: r.fixture.category,
    overallStatus,
    guards,
  }
}
