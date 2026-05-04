/**
 * dna-compliance.ts
 * Checks a template's block composition against a category's DNA definition.
 * Pure function — no DB calls, no side effects.
 */

// ── Types ─────────────────────────────────────────────────────────────────────

export type ViolationSeverity = 'error' | 'warning'
export type ViolationType =
    | 'missing-signature'
    | 'wrong-order'
    | 'forbidden-used'
    | 'min-sections-not-met'
    | 'personality-mismatch'

export type Violation = {
    type: ViolationType
    message: string
    severity: ViolationSeverity
}

export type ComplianceResult = {
    pass: boolean
    score: number          // 0–100
    violations: Violation[]
    checkedAt: string      // ISO timestamp
}

// ── DNA shape (runtime-editable JSON from categories.dna) ─────────────────────

export type CategoryDNA = {
    signatureBlocks?: string[]
    recommendedBlocks?: string[]
    mandatoryOrder?: string[]
    forbiddenBlocks?: string[]
    typicalPersonalities?: string[]
    minSections?: number
    aiPromptHint?: string
}

// ── Template shape (minimal subset needed for compliance check) ───────────────

type TemplateLike = {
    personality?: string | null
    templatePages?: Array<{
        layout?: unknown
    }> | null
    defaultBlocks?: unknown
    // dnaComplianceCache intentionally excluded (write-back field)
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extracts all block slugs referenced in a template.
 * Reads from templatePages[].layout (array of {type,...}) and defaultBlocks.
 */
function extractBlockSlugs(template: TemplateLike): string[] {
    const slugs: string[] = []

    const extractFromLayout = (layout: unknown) => {
        if (!Array.isArray(layout)) return
        for (const block of layout) {
            if (block && typeof block === 'object' && 'type' in block) {
                const t = (block as Record<string, unknown>).type
                if (typeof t === 'string') slugs.push(t)
            }
        }
    }

    if (Array.isArray(template.templatePages)) {
        for (const page of template.templatePages) {
            extractFromLayout(page.layout)
        }
    }

    if (template.defaultBlocks) {
        extractFromLayout(template.defaultBlocks)
    }

    return slugs
}

// ── Main export ───────────────────────────────────────────────────────────────

/**
 * Checks a template's compliance with the given category DNA.
 * Returns structured result with violations and overall score.
 *
 * Score: starts at 100, deducts per violation severity:
 *   error   → -20 each (capped at 0)
 *   warning → -5 each
 */
export function checkCompliance(
    template: TemplateLike,
    dna: Record<string, unknown>,
): ComplianceResult {
    const violations: Violation[] = []
    const d = dna as CategoryDNA

    const blockSlugs = extractBlockSlugs(template)
    const blockSet = new Set(blockSlugs)

    // ── 1. Signature blocks present ──────────────────────────────────────────
    const signatureBlocks = d.signatureBlocks ?? []
    for (const required of signatureBlocks) {
        if (!blockSet.has(required)) {
            violations.push({
                type: 'missing-signature',
                message: `Missing required block: "${required}"`,
                severity: 'error',
            })
        }
    }

    // ── 2. Mandatory order ───────────────────────────────────────────────────
    const mandatoryOrder = d.mandatoryOrder ?? []
    if (mandatoryOrder.length > 1 && blockSlugs.length > 0) {
        // Filter to only blocks that appear in both mandatoryOrder and the template
        const presentOrdered = mandatoryOrder.filter(b => blockSet.has(b))
        const actualPositions = presentOrdered.map(b => blockSlugs.indexOf(b))
        const isOrdered = actualPositions.every(
            (pos, i) => i === 0 || pos > actualPositions[i - 1]
        )
        if (!isOrdered) {
            violations.push({
                type: 'wrong-order',
                message: `Block order does not follow mandatory sequence: ${mandatoryOrder.join(' → ')}`,
                severity: 'warning',
            })
        }
    }

    // ── 3. Forbidden blocks absent ───────────────────────────────────────────
    const forbiddenBlocks = d.forbiddenBlocks ?? []
    for (const forbidden of forbiddenBlocks) {
        if (blockSet.has(forbidden)) {
            violations.push({
                type: 'forbidden-used',
                message: `Forbidden block used: "${forbidden}"`,
                severity: 'error',
            })
        }
    }

    // ── 4. Min sections ──────────────────────────────────────────────────────
    const minSections = d.minSections ?? 5
    if (blockSlugs.length > 0 && blockSlugs.length < minSections) {
        violations.push({
            type: 'min-sections-not-met',
            message: `Template has ${blockSlugs.length} blocks, minimum is ${minSections}`,
            severity: 'warning',
        })
    }

    // ── 5. Personality match ─────────────────────────────────────────────────
    const typicalPersonalities = d.typicalPersonalities ?? []
    if (
        template.personality &&
        typicalPersonalities.length > 0 &&
        !typicalPersonalities.includes(template.personality)
    ) {
        violations.push({
            type: 'personality-mismatch',
            message: `Personality "${template.personality}" not typical for this category (expected: ${typicalPersonalities.join(', ')})`,
            severity: 'warning',
        })
    }

    // ── Score ────────────────────────────────────────────────────────────────
    let score = 100
    for (const v of violations) {
        score -= v.severity === 'error' ? 20 : 5
    }
    score = Math.max(0, score)

    const hasErrors = violations.some(v => v.severity === 'error')

    return {
        pass: !hasErrors,
        score,
        violations,
        checkedAt: new Date().toISOString(),
    }
}
