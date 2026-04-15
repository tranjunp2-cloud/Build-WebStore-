/**
 * Shared types for the AI gen test harness.
 * Stable schema (versioned) — consumed by Phase 02 (structural assertions) + Phase 03 (visual).
 */

export type HarnessMode = 'full' | 'quick'

export type ComposerSource = 'blueprint' | 'legacy'

/** A single test case in the matrix — one composer invocation input. */
export type Fixture = {
  /** Unique id, e.g. "restaurant-premium-seed42-bp12" */
  id: string
  category: string
  variant: 'starter' | 'professional' | 'premium'
  businessIndex: number
  compositionSeed: number
  source: ComposerSource
  /** For 'blueprint' source — index into TEMPLATE_PRESETS */
  presetIndex?: number
  /** Expected invariants (from CATEGORY_DNA) — checked by Phase 02 */
  expectedSignatureBlocks: string[]
  expectedMinBlocks: number
  expectedMaxBlocks: number
}

/** Output of invoking the composer for one fixture. */
export type HarnessResult = {
  fixture: Fixture
  /** Homepage blocks (layout) — the primary thing we assert on */
  blocks: HarnessBlock[]
  /** Theme config from the composer output */
  theme: Record<string, unknown>
  /** Page count (full TemplateSeed.pages.length) */
  pageCount: number
  /** Error message if composer threw (still written to matrix, Phase 02 counts as FAIL) */
  composerError?: string
  durationMs: number
}

/** Minimal block shape — captures everything the composer emits for inspection */
export type HarnessBlock = {
  blockType: string
  variant?: string
  /** All non-meta fields from the composer block (items, testimonials, cta, etc.) */
  data: Record<string, unknown>
}

/** Top-level matrix.json schema */
export type MatrixReport = {
  schemaVersion: 1
  generatedAt: string
  mode: HarnessMode
  opts: {
    categories: string[]
    variants: Array<'starter' | 'professional' | 'premium'>
    seedsPerCell: number
  }
  summary: {
    total: number
    composed: number
    composerErrors: number
    totalDurationMs: number
  }
  results: HarnessResult[]
}

/** Structural guard report (Phase 02) */
export type GuardStatus = 'pass' | 'fail' | 'warn'
export type GuardReport = {
  name: string
  status: GuardStatus
  reason?: string
  data?: Record<string, unknown>
}

export type StructuralReport = {
  schemaVersion: 1
  generatedAt: string
  summary: {
    total: number
    pass: number
    fail: number
    warn: number
  }
  fixtures: Array<{
    fixtureId: string
    category: string
    overallStatus: GuardStatus
    guards: GuardReport[]
  }>
  varietyMetrics: {
    byCategory: Record<
      string,
      { heroVariants: string[]; featureVariants: string[]; footerVariants: string[]; uniqueOrderings: number }
    >
  }
}
