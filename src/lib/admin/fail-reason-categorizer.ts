/**
 * fail-reason-categorizer.ts
 * Regex-based classifier for AI generation error logs.
 * Maps raw error strings to one of 6 fixed categories.
 *
 * Add new patterns here as real error types emerge — start with 5 known ones.
 */

// ── Category enum ─────────────────────────────────────────────────────────────

export const FAIL_CATEGORIES = [
  'timeout',
  'rate-limit',
  'bad-request',
  'json-parse',
  'openai-server',
  'other',
] as const

export type FailCategory = (typeof FAIL_CATEGORIES)[number]

// ── Pattern map (ordered: most-specific first) ────────────────────────────────

const PATTERNS: Array<{ category: FailCategory; regexes: RegExp[] }> = [
  {
    category: 'timeout',
    regexes: [/timeout/i, /ETIMEDOUT/i, /timed out/i, /ECONNRESET/i],
  },
  {
    category: 'rate-limit',
    regexes: [/429/i, /rate.?limit/i, /too many requests/i, /quota/i],
  },
  {
    category: 'bad-request',
    regexes: [/\b400\b/, /invalid request/i, /bad request/i, /validation failed/i],
  },
  {
    category: 'json-parse',
    regexes: [/SyntaxError/i, /JSON\.parse/i, /parse.*JSON/i, /unexpected token/i, /invalid json/i],
  },
  {
    category: 'openai-server',
    regexes: [/\b500\b/, /\b502\b/, /\b503\b/, /internal server error/i, /service unavailable/i],
  },
]

// ── Core classifier ───────────────────────────────────────────────────────────

/**
 * Returns the category for a single error log string.
 * Falls back to 'other' if no pattern matches.
 */
export function classifyError(errorLog: string | null | undefined): FailCategory {
  if (!errorLog || errorLog.trim() === '') return 'other'

  for (const { category, regexes } of PATTERNS) {
    if (regexes.some((re) => re.test(errorLog))) {
      return category
    }
  }

  return 'other'
}

// ── Batch aggregator ──────────────────────────────────────────────────────────

/**
 * Counts occurrences of each FailCategory across a batch of records.
 * Input: array of objects with optional errorLog field.
 * Returns: Record<FailCategory, number> with all categories present (may be 0).
 */
export function categorizeFailures(
  records: Array<{ errorLog?: string | null }>,
): Record<FailCategory, number> {
  const counts = Object.fromEntries(
    FAIL_CATEGORIES.map((cat) => [cat, 0]),
  ) as Record<FailCategory, number>

  for (const record of records) {
    const cat = classifyError(record.errorLog)
    counts[cat]++
  }

  return counts
}
