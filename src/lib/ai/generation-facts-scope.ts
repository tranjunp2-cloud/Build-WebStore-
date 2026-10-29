/**
 * Request-local FACTS (#2103 A1). The generation pipeline has many entry points
 * (template-first, AI-first, page-split, fallback) that all derive a
 * `Partial<BusinessSample>` via `mapBusinessInfo`. Instead of threading `facts`
 * through every signature, `generateSiteWithAI` runs inside this scope and
 * `mapBusinessInfo` picks it up — same pattern as the AI actor scope.
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import type { GenerationFacts } from './generation-facts'

const storage = new AsyncLocalStorage<GenerationFacts | undefined>()

export function runWithGenerationFacts<T>(facts: GenerationFacts | undefined, fn: () => T): T {
  return storage.run(facts, fn)
}

export function currentGenerationFacts(): GenerationFacts | undefined {
  return storage.getStore()
}
