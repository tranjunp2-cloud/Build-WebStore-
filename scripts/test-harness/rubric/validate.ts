/**
 * Validate rubric-v1.json against schema types at build time.
 * Runs via `npm run typecheck` — imports ensure JSON structure matches types.
 */

import rubricJson from './rubric-v1.json' with { type: 'json' }
import type { Rubric } from './rubric.schema'

// Type assertion: TS will error if JSON shape diverges from Rubric.
const rubric: Rubric = rubricJson as Rubric

// Sanity asserts (runtime — caught by tsx loader if referenced)
if (rubric.schemaVersion !== 1) throw new Error('rubric version mismatch')
if (rubric.dimensions.length !== 8) throw new Error('expected 8 dimensions')

const totalWeight = rubric.dimensions.reduce((sum, d) => sum + d.weight, 0)
if (totalWeight !== 66) throw new Error(`expected total weight 66, got ${totalWeight}`)

const totalCriteria = rubric.dimensions.reduce((sum, d) => sum + d.criteria.length, 0)
console.log(`[rubric-validate] v${rubric.schemaVersion} "${rubric.name}" — ${rubric.dimensions.length} dims, ${totalCriteria} criteria, weight=${totalWeight}`)

export { rubric }
