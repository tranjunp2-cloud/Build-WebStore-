/**
 * Template drift validator — verifies every template block reference
 * (TS presets + optionally DB-seeded `templates` rows) still matches the
 * live block registry. Catches silent drift when:
 *   - a block is removed from registry,
 *   - a variant is renamed,
 *   - required prop is added/renamed,
 * but a template still references the stale shape.
 *
 * Called from `npm run drift:check` (Vitest). DB scan is gated behind
 * `DRIFT_CHECK_DB=1` env so PR CI stays fast (no Payload boot).
 *
 * Plan: plans/260419-2022-GH-1-harness-template-block-sync-flow/phase-02-extend-drift-detection.md
 */

import { blockRegistry } from '@/blocks/registry'
import { TEMPLATE_PRESETS } from '@/lib/ai/template-definitions'
import { computeBlockSchemaVersion } from '@/lib/ai/block-schema-version'
import type { BasePayload } from 'payload'

// ── Types ────────────────────────────────────────────────────────────────────

export type DriftFinding = {
  source: 'ts' | 'db'
  templateId: string
  blockType: string
  variant?: string
  issue: 'unknown-block' | 'unknown-variant' | 'schema-drift' | 'stale-version'
  expected?: readonly string[]
  zodIssues?: unknown[]
}

type BlockRef = { blockType: string; variant?: string; [key: string]: unknown }

type ValidateContext = {
  source: DriftFinding['source']
  templateId: string
  /**
   * Skip Zod schema validation. Use when the ref is a preset BlockSpec
   * (no content fields — composer fills them later). Registry + variant
   * checks still run.
   */
  skipSchema?: boolean
}

// Zod issue codes we treat as structural drift — rename/remove/type errors.
// Content-length (`too_small`, `too_big`, `invalid_string`) is OK —
// templates ship with empty strings that get personalized later.
const STRUCTURAL_ZOD_CODES = new Set(['invalid_type', 'unrecognized_keys'])

// ── Core validator ───────────────────────────────────────────────────────────

/** Validate a single block ref against the live registry. */
export function validateBlockRef(
  ref: BlockRef,
  context: ValidateContext,
): DriftFinding | null {
  const { blockType, variant } = ref
  const findingCtx = {
    source: context.source,
    templateId: context.templateId,
  }

  if (!blockRegistry.has(blockType)) {
    return { ...findingCtx, blockType, variant, issue: 'unknown-block' }
  }

  const meta = blockRegistry.getBlockMeta(blockType)
  if (variant && meta?.variants && !meta.variants.includes(variant)) {
    return {
      ...findingCtx,
      blockType,
      variant,
      issue: 'unknown-variant',
      expected: meta.variants,
    }
  }

  if (context.skipSchema) return null

  const schema = blockRegistry.getSchema(blockType)
  // No schema registered → nothing structural to check. Not a drift signal:
  // registry + variant already passed above. Schema coverage is a separate
  // code-quality concern, tracked outside this validator.
  if (!schema) return null

  const parsed = schema.safeParse(ref)
  if (parsed.success) return null

  // Classify Zod issues — only fail on structural drift.
  // Zod issue shape: { code, path, message, keys?, expected?, received? }
  const allIssues = (parsed.error.issues ?? []) as Array<{
    code: string
    path: Array<string | number>
    message: string
    received?: unknown
    expected?: unknown
  }>
  const structural = allIssues.filter((iss) => {
    if (STRUCTURAL_ZOD_CODES.has(iss.code)) return true
    // "required" surfaces as `invalid_type` with received === 'undefined'
    // (already covered above). Keep this branch for forward-compat Zod
    // versions that may emit a dedicated `required` code.
    if (iss.code === 'required') return true
    return false
  })

  if (structural.length === 0) return null

  return {
    ...findingCtx,
    blockType,
    variant,
    issue: 'schema-drift',
    zodIssues: structural,
  }
}

// ── TS source scanner ────────────────────────────────────────────────────────

/**
 * Scan every block ref embedded in `TEMPLATE_PRESETS[].pages[].blocks[]`.
 *
 * Presets store `BlockSpec` ({ blockType, variant, count, overrides }) —
 * NOT full block data. Content is filled by the composer later. So we
 * only check registry + variant existence; schema-drift is skipped for
 * the bare spec. If the spec has `overrides`, we schema-validate the
 * merged override shape (so a preset that hardcodes a removed prop name
 * is caught).
 *
 * Note: `TEMPLATE_DEFINITIONS` carries no block refs (just
 * category/variant/themePreset) so it is not scanned.
 */
export function scanTsTemplates(): DriftFinding[] {
  const findings: DriftFinding[] = []
  for (const preset of TEMPLATE_PRESETS) {
    const pages = preset.pages ?? []
    for (const page of pages) {
      const blocks = (page.blocks ?? []) as Array<BlockRef & { overrides?: Record<string, unknown> }>
      for (const block of blocks) {
        const templateId = `${preset.id}${page.slug ? `:${page.slug}` : ''}`

        // Always check registry + variant (structural, cheap).
        const structural = validateBlockRef(block, {
          source: 'ts',
          templateId,
          skipSchema: true,
        })
        if (structural) {
          findings.push(structural)
          continue
        }

        // If overrides are supplied, validate the merged shape — catches
        // presets hardcoding renamed/removed prop names.
        if (block.overrides && Object.keys(block.overrides).length > 0) {
          const merged = { ...block, ...block.overrides }
          const override = validateBlockRef(merged, { source: 'ts', templateId })
          // Only keep unrecognized_keys findings here — missing-required
          // is expected (composer fills content).
          if (override?.issue === 'schema-drift') {
            const onlyUnrecognized = (override.zodIssues ?? []).filter(
              (iss) => (iss as { code?: string }).code === 'unrecognized_keys',
            )
            if (onlyUnrecognized.length > 0) {
              findings.push({ ...override, zodIssues: onlyUnrecognized })
            }
          }
        }
      }
    }
  }
  return findings
}

// ── DB scanner ───────────────────────────────────────────────────────────────

/**
 * Scan Payload `templates` collection rows. Flattens both legacy
 * `defaultBlocks` JSON and modern `templatePages[].layout` JSON arrays.
 * Gated by caller behind `DRIFT_CHECK_DB=1` so PR CI stays fast.
 */
export async function scanDbTemplates(payload: BasePayload): Promise<DriftFinding[]> {
  const res = await payload.find({
    collection: 'templates' as never,
    limit: 500,
    depth: 0,
  })

  // Phase 05 — compute current registry hash once, compare each row's stamp.
  // Rows with null/undefined stamp are LEGACY (pre-Phase-05 seed) — skipped to
  // avoid drift noise until admin re-seeds. Only actively-stamped rows that
  // mismatch current snapshot are surfaced.
  const currentVersion = computeBlockSchemaVersion()

  const findings: DriftFinding[] = []
  for (const doc of res.docs as Array<Record<string, unknown>>) {
    const templateId = String(doc.id ?? doc.name ?? 'unknown')

    // Legacy homepage blocks (flat JSON array).
    const legacy = Array.isArray(doc.defaultBlocks) ? (doc.defaultBlocks as BlockRef[]) : []
    for (const block of legacy) {
      const result = validateBlockRef(block, { source: 'db', templateId })
      if (result) findings.push(result)
    }

    // Multi-page layouts.
    const pages = Array.isArray(doc.templatePages)
      ? (doc.templatePages as Array<{ slug?: string; layout?: BlockRef[] }>)
      : []
    for (const page of pages) {
      const layout = Array.isArray(page.layout) ? page.layout : []
      for (const block of layout) {
        const result = validateBlockRef(block, {
          source: 'db',
          templateId: `${templateId}${page.slug ? `:${page.slug}` : ''}`,
        })
        if (result) findings.push(result)
      }
    }

    // Per-template stale-version check (Phase 05).
    const storedVersion = typeof doc.blockSchemaVersion === 'string' ? doc.blockSchemaVersion : null
    if (storedVersion && storedVersion !== currentVersion) {
      findings.push({
        source: 'db',
        templateId,
        blockType: '*',
        issue: 'stale-version',
      })
    }
  }
  return findings
}
