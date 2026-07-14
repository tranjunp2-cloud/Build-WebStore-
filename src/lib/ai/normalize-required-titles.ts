/**
 * Backfill Payload-required array-item fields before they reach a draft save
 * (GH-1621).
 *
 * Why this exists: Payload page drafts save without required-field validation
 * (versions.drafts.autosave, no validate:true override in Pages.ts) — any code
 * path that can mutate a page's blocks and then let the editor autosave persist
 * them can produce a draft with a blank required array-item field (e.g. Portfolio
 * Grid `projects[].title`, Team `members[].name`). That data only fails much
 * later, at Publish. Two entry points are covered:
 *
 *   1. `normalizeChangesRequiredFields()` — /api/ai/edit-block's "update_block"/
 *      "update_multiple_blocks" actions apply the AI's `changes` directly to a
 *      block with no schema validation step in between. Confirmed live gap.
 *   2. `sanitizeBlocksRequiredFields()` — the generic draft-save endpoint
 *      (/api/sites/[siteId]/save), which persists whatever `blocks` the client
 *      sends — AI-applied changes AND manual edits (e.g. SettingsPanel's
 *      testimonials add/edit form, which lets a user blank out an existing
 *      required field via onBlur). Last-line-of-defense for every path at once.
 *
 * The media-injector.ts padding fix in the same GH-1621 pass addresses a third,
 * narrower angle (image-injection creating content-free array items) — its sole
 * caller (generate-site) creates pages as `_status:'published'` (not draft),
 * which IS fully validated at creation time, so it does not share this draft-skip
 * mechanism. See the GH-1621 journal entry for the full analysis.
 *
 * booking-widget is intentionally excluded — its required field is `name` but on
 * `services[]`, and it also carries service-cards-shaped cosmetic fields that
 * don't apply to it; not covered by either table below.
 */

type RequiredFieldRule = { requiredField: string; altFields?: string[]; fallbackPrefix: string }

/** blockType → its array field + the required field(s) on each item, in the
 *  order they should be checked/backfilled. Add a new block here (one line) —
 *  no new function needed. */
const REQUIRED_ARRAY_FIELDS: Record<string, { arrayField: string; rules: RequiredFieldRule[] }> = {
    'portfolio-grid': { arrayField: 'projects', rules: [{ requiredField: 'title', altFields: ['name', 'heading'], fallbackPrefix: 'Project' }] },
    team: { arrayField: 'members', rules: [{ requiredField: 'name', fallbackPrefix: 'Team Member' }] },
    'doctor-profile': { arrayField: 'doctors', rules: [{ requiredField: 'name', fallbackPrefix: 'Doctor' }] },
}

/** The AI's edit-block prompt gives no shape guidance for array fields other than
 *  `services` (which explicitly documents the object shape) — so a bare string
 *  item (e.g. `projects: ["Downtown Loft Renovation"]`) is a realistic response
 *  shape for any field in REQUIRED_ARRAY_FIELDS, not just services. Normalize it
 *  to an object keyed on the FIRST rule's required field before any check, so the
 *  string itself becomes that field's value instead of being silently discarded. */
function toFieldObject(it: unknown, primaryField: string): Record<string, unknown> {
    return typeof it === 'string' ? { [primaryField]: it } : (typeof it === 'object' && it !== null ? it : {}) as Record<string, unknown>
}

function backfillRequiredFields(items: unknown[], rules: RequiredFieldRule[]): Record<string, unknown>[] {
    return items.map((it, i) => {
        let obj = toFieldObject(it, rules[0].requiredField)
        for (const rule of rules) {
            if (obj[rule.requiredField]) continue
            const altValue = rule.altFields?.map((f) => obj[f]).find(Boolean)
            const fallback = altValue || `${rule.fallbackPrefix} ${i + 1}`
            obj = { ...obj, [rule.requiredField]: String(fallback) }
        }
        return obj
    })
}

/** service-cards also wants a non-empty `description`/`icon` — cosmetic, not
 *  Payload-required, so kept separate from the generic backfill above. */
export function coerceServiceItems(services: unknown[]): Record<string, unknown>[] {
    return backfillRequiredFields(services, [{ requiredField: 'title', altFields: ['name', 'heading'], fallbackPrefix: 'Service' }]).map((sv) => ({
        ...sv,
        icon: sv.icon ?? '⭐',
        // Only set description when absent — avoid overwriting a valid description with ''
        description: sv.description !== undefined ? sv.description : (sv.text || sv.body || ''),
    }))
}

/** testimonials.testimonials[] needs BOTH `quote` and `name`, but `quote` has no
 *  safe generic fallback — inventing fake customer testimony is worse than not
 *  showing the item at all. Items with no quote are dropped entirely; `name`
 *  still gets a generic backfill like every other required field above. */
export function sanitizeTestimonialItems(items: unknown[]): Record<string, unknown>[] {
    return items
        .map((it) => (typeof it === 'object' && it !== null ? it : {}) as Record<string, unknown>)
        .filter((it) => Boolean(it.quote))
        .map((it, i) => (it.name ? it : { ...it, name: `Customer ${i + 1}` }))
}

/** Applies the right required-field backfill to one block's own data (its actual
 *  content, not a partial `changes` patch) based on `blockType`. Shared by both
 *  entry points below. Mutates nothing outside the returned object's array field. */
function sanitizeBlockRequiredFields(blockType: string, blockData: Record<string, unknown>): void {
    if (blockType === 'service-cards' && Array.isArray(blockData.services)) {
        blockData.services = coerceServiceItems(blockData.services)
        return
    }
    if (blockType === 'testimonials' && Array.isArray(blockData.testimonials)) {
        blockData.testimonials = sanitizeTestimonialItems(blockData.testimonials)
        return
    }
    const rule = REQUIRED_ARRAY_FIELDS[blockType]
    if (rule && Array.isArray(blockData[rule.arrayField])) {
        blockData[rule.arrayField] = backfillRequiredFields(blockData[rule.arrayField] as unknown[], rule.rules)
    }
}

/** Entry point 1 — walk `changes` (or one `updates[].changes` entry) and backfill
 *  required array-item fields for the target block's type. Mutates nothing
 *  outside `changes` itself. */
export function normalizeChangesRequiredFields(
    changes: Record<string, unknown>,
    existingBlock?: Record<string, unknown> | null,
): void {
    const blockType = (existingBlock?.blockType as string) ?? (changes.blockType as string)
    if (!blockType) {
        console.warn('[normalizeChangesRequiredFields] blockType undetermined — skipping required-field normalization')
        return
    }
    sanitizeBlockRequiredFields(blockType, changes)
}

/** Entry point 2 — last line of defense before a draft save: walk every block in
 *  a full page layout and backfill required array-item fields in place. Covers
 *  paths entry point 1 doesn't reach (e.g. manual SettingsPanel edits that blank
 *  out an existing required field). Returns a NEW array; does not mutate input. */
export function sanitizeBlocksRequiredFields(blocks: Record<string, unknown>[]): Record<string, unknown>[] {
    return blocks.map((block) => {
        const blockType = typeof block?.blockType === 'string' ? block.blockType : undefined
        if (!blockType) return block
        const copy = { ...block }
        sanitizeBlockRequiredFields(blockType, copy)
        return copy
    })
}
