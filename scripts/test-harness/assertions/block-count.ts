/**
 * Guard: block count within [expectedMinBlocks, expectedMaxBlocks].
 * Catches the most obvious Ben-Ben symptom: homepage rendering only 3-5 blocks.
 */

import type { HarnessResult, GuardReport } from '../types'

export function blockCountGuard(r: HarnessResult): GuardReport {
  const count = r.blocks.length
  const { expectedMinBlocks, expectedMaxBlocks } = r.fixture

  if (count < expectedMinBlocks) {
    return {
      name: 'block-count',
      status: 'fail',
      reason: `too few blocks: ${count} < ${expectedMinBlocks} (Ben-Ben empty-hole symptom)`,
      data: { count, expectedMinBlocks, expectedMaxBlocks },
    }
  }
  if (count > expectedMaxBlocks) {
    return {
      name: 'block-count',
      status: 'warn',
      reason: `too many blocks: ${count} > ${expectedMaxBlocks} (page may feel bloated)`,
      data: { count, expectedMinBlocks, expectedMaxBlocks },
    }
  }
  return { name: 'block-count', status: 'pass', data: { count } }
}
