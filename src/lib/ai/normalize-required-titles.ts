/**
 * Backfill Payload-required array-item fields before they reach Publish
 * (GH-1621).
 *
 * Why this exists: Payload page drafts save without required-field validation
 * (versions.drafts.autosave, no validate:true override in Pages.ts) — any code
 * path that can mutate a page's blocks can produce a draft with a blank required
 * array-item field (e.g. Portfolio Grid `projects[].title`, Team `members[].name`).
 * That data only fails much later, at Publish. Two entry points are covered:
 *
 *   1. `normalizeChangesRequiredFields()` — /api/ai/edit-block's "update_block"/
 *      "update_multiple_blocks" actions apply the AI's `changes` directly to a
 *      block with no schema validation step in between. Confirmed live gap.
 *   2. `sanitizeBlocksRequiredFields()` — called from the PUBLISH route, right
 *      before a page's draft is promoted (`src/app/api/sites/[siteId]/publish/route.ts`).
 *      Deliberately NOT wired into every draft autosave (`/api/sites/[siteId]/save`)
 *      — an earlier version of this fix did that and it silently backfilled/dropped
 *      content on blocks the user wasn't even editing, and could permanently drop
 *      an in-progress testimonial mid-edit on an autosave debounce race (caught in
 *      code review before merge). Running only at publish time means nothing is
 *      touched until the user has actually finished editing and asked to go live —
 *      still closes the manual-UI-edit gap (whatever's in the draft by then gets
 *      sanitized regardless of how it got there), with none of the mid-edit risk.
 *
 * The media-injector.ts padding fix in the same GH-1621 pass addresses a third,
 * narrower angle (image-injection creating content-free array items) — its sole
 * caller (generate-site) creates pages as `_status:'published'` (not draft),
 * which IS fully validated at creation time, so it does not share this draft-skip
 * mechanism. See the GH-1621 journal entry for the full analysis.
 *
 * Coverage:
 *   - safe single-field backfill: portfolio-grid, team, doctor-profile,
 *     property-card
 *   - safe bespoke rules: service-cards, testimonials
 *   - publish-time filtering for incomplete items whose required fields are
 *     unsafe to fabricate: features, stats, faq, pricing, pricing-table,
 *     navigation, footer
 *
 * For the filter-only group, publish prefers "drop the broken row" over "invent
 * deceptive content" (e.g. a fake price, fake FAQ answer, fake nav URL). Since
 * this runs only at publish time, the draft itself stays untouched while the
 * user is editing; only the live payload is sanitized.
 */

type RequiredFieldRule = { requiredField: string; altFields?: string[]; fallbackPrefix: string }
type RequiredShapeField = { name: string; altFields?: string[] }

/** blockType → its array field + the one required field on each item. Add a new
 *  single-required-field block here (one line) — no new function needed. Blocks
 *  needing multiple required fields (service-cards, testimonials) get a bespoke
 *  function below instead — see file header for why this stays single-rule. */
const REQUIRED_ARRAY_FIELDS: Record<string, { arrayField: string } & RequiredFieldRule> = {
    'portfolio-grid': { arrayField: 'projects', requiredField: 'title', altFields: ['name', 'heading'], fallbackPrefix: 'Project' },
    team: { arrayField: 'members', requiredField: 'name', fallbackPrefix: 'Team Member' },
    'doctor-profile': { arrayField: 'doctors', requiredField: 'name', fallbackPrefix: 'Doctor' },
    'property-card': { arrayField: 'properties', requiredField: 'title', altFields: ['name', 'heading'], fallbackPrefix: 'Property' },
}

function getNonBlankString(value: unknown): string | null {
    return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null
}

/** The AI's edit-block prompt gives no shape guidance for array fields other than
 *  `services` (which explicitly documents the object shape) — so a bare string
 *  item (e.g. `projects: ["Downtown Loft Renovation"]`) is a realistic response
 *  shape for any of these fields. Normalize it to an object keyed on the given
 *  field before any check, so the string itself becomes that field's value
 *  instead of being silently discarded. */
function toFieldObject(it: unknown, primaryField: string): Record<string, unknown> {
    return typeof it === 'string' ? { [primaryField]: it } : (typeof it === 'object' && it !== null ? it : {}) as Record<string, unknown>
}

function backfillRequiredField(items: unknown[], rule: RequiredFieldRule): Record<string, unknown>[] {
    return items.map((it, i) => {
        const obj = toFieldObject(it, rule.requiredField)
        const currentValue = getNonBlankString(obj[rule.requiredField])
        if (currentValue) return { ...obj, [rule.requiredField]: currentValue }
        const altValue = rule.altFields?.map((f) => getNonBlankString(obj[f])).find(Boolean)
        const fallback = altValue || `${rule.fallbackPrefix} ${i + 1}`
        return { ...obj, [rule.requiredField]: String(fallback) }
    })
}

function sanitizeRequiredShapeItems(items: unknown[], fields: RequiredShapeField[]): Record<string, unknown>[] {
    return items.flatMap((it) => {
        const obj = typeof it === 'object' && it !== null ? { ...(it as Record<string, unknown>) } : {}
        for (const field of fields) {
            const currentValue = getNonBlankString(obj[field.name])
            if (currentValue) {
                obj[field.name] = currentValue
                continue
            }
            const altValue = field.altFields?.map((name) => getNonBlankString(obj[name])).find(Boolean)
            if (!altValue) return []
            obj[field.name] = altValue
        }
        return [obj]
    })
}

/** service-cards also wants a non-empty `description`/`icon` — cosmetic, not
 *  Payload-required, so kept separate from the generic backfill above. */
export function coerceServiceItems(services: unknown[]): Record<string, unknown>[] {
    return backfillRequiredField(services, { requiredField: 'title', altFields: ['name', 'heading'], fallbackPrefix: 'Service' }).map((sv) => ({
        ...sv,
        icon: sv.icon ?? '⭐',
        // Only set description when absent — avoid overwriting a valid description with ''
        description: sv.description !== undefined ? sv.description : (sv.text || sv.body || ''),
    }))
}

/** testimonials.testimonials[] needs BOTH `quote` and `name`, but `quote` has no
 *  safe generic fallback — inventing fake customer testimony is worse than not
 *  showing the item at all. Items with no quote are dropped entirely; `name`
 *  still gets a generic backfill like every other required field above. A bare
 *  string item (AI has no shape guidance for this field either) is normalized to
 *  `{quote: <string>}` first, same as the generic path, so real AI-generated
 *  testimonial text isn't mistaken for "no quote" and discarded. */
export function sanitizeTestimonialItems(items: unknown[]): Record<string, unknown>[] {
    return items
        .map((it) => toFieldObject(it, 'quote'))
        .flatMap((it) => {
            const quote = getNonBlankString(it.quote)
            if (!quote) return []
            return [{ ...it, quote }]
        })
        .map((it, i) => ({ ...it, name: getNonBlankString(it.name) || `Customer ${i + 1}` }))
}

function sanitizeFeatureItems(items: unknown[]): Record<string, unknown>[] {
    return sanitizeRequiredShapeItems(items, [
        { name: 'title', altFields: ['name', 'heading'] },
        { name: 'description', altFields: ['text', 'body', 'content'] },
    ])
}

function sanitizeStatItems(items: unknown[]): Record<string, unknown>[] {
    return sanitizeRequiredShapeItems(items, [
        { name: 'value' },
        { name: 'label', altFields: ['name', 'title'] },
    ])
}

function sanitizeFaqItems(items: unknown[]): Record<string, unknown>[] {
    return sanitizeRequiredShapeItems(items, [
        { name: 'question', altFields: ['title', 'name'] },
        { name: 'answer', altFields: ['description', 'body', 'content', 'text'] },
    ])
}

function sanitizePricingPlans(items: unknown[]): Record<string, unknown>[] {
    return sanitizeRequiredShapeItems(items, [
        { name: 'name', altFields: ['title', 'heading'] },
        { name: 'price' },
    ]).map((plan) => ({
        ...plan,
        features: Array.isArray(plan.features)
            ? plan.features.flatMap((feature) => {
                if (typeof feature === 'string') {
                    const text = getNonBlankString(feature)
                    return text ? [{ text }] : []
                }
                return sanitizeRequiredShapeItems([feature], [{ name: 'text' }])
            })
            : plan.features,
    }))
}

function sanitizePricingTablePlans(items: unknown[]): Record<string, unknown>[] {
    return sanitizeRequiredShapeItems(items, [
        { name: 'name', altFields: ['title', 'heading'] },
        { name: 'price' },
    ])
}

function sanitizeNavLinks(items: unknown[]): Record<string, unknown>[] {
    return sanitizeRequiredShapeItems(items, [
        { name: 'label', altFields: ['name', 'title'] },
        { name: 'url' },
    ]).map((link) => ({
        ...link,
        children: Array.isArray(link.children) ? sanitizeNavLinks(link.children) : link.children,
    }))
}

function sanitizeFooterColumns(items: unknown[]): Record<string, unknown>[] {
    return sanitizeRequiredShapeItems(items, [{ name: 'title', altFields: ['name', 'heading'] }]).map((column) => ({
        ...column,
        links: Array.isArray(column.links) ? sanitizeNavLinks(column.links) : column.links,
    }))
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
    if (blockType === 'features' && Array.isArray(blockData.features)) {
        blockData.features = sanitizeFeatureItems(blockData.features)
        return
    }
    if (blockType === 'stats' && Array.isArray(blockData.stats)) {
        blockData.stats = sanitizeStatItems(blockData.stats)
        return
    }
    if (blockType === 'faq' && Array.isArray(blockData.faqs)) {
        blockData.faqs = sanitizeFaqItems(blockData.faqs)
        return
    }
    if (blockType === 'pricing' && Array.isArray(blockData.plans)) {
        blockData.plans = sanitizePricingPlans(blockData.plans)
        return
    }
    if (blockType === 'pricing-table' && Array.isArray(blockData.plans)) {
        blockData.plans = sanitizePricingTablePlans(blockData.plans)
        return
    }
    if (blockType === 'navigation' && Array.isArray(blockData.links)) {
        blockData.links = sanitizeNavLinks(blockData.links)
        return
    }
    if (blockType === 'footer' && Array.isArray(blockData.columns)) {
        blockData.columns = sanitizeFooterColumns(blockData.columns)
        return
    }
    const rule = REQUIRED_ARRAY_FIELDS[blockType]
    if (rule && Array.isArray(blockData[rule.arrayField])) {
        blockData[rule.arrayField] = backfillRequiredField(blockData[rule.arrayField] as unknown[], rule)
    }
}

export function sanitizeSingleBlockRequiredFields(block: Record<string, unknown>): Record<string, unknown> {
    const blockType = typeof block?.blockType === 'string' ? block.blockType : undefined
    if (!blockType) return block
    const copy = { ...block }
    sanitizeBlockRequiredFields(blockType, copy)
    return copy
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

/** Entry point 2 — last line of defense right before a page's draft is promoted
 *  to published (called from publish/route.ts, NOT from every draft autosave —
 *  see file header for why). Walks every block in a full page layout and
 *  backfills required array-item fields. Returns a NEW array; does not mutate
 *  input. */
export function sanitizeBlocksRequiredFields(blocks: Record<string, unknown>[]): Record<string, unknown>[] {
    return blocks.map((block) => sanitizeSingleBlockRequiredFields(block))
}
