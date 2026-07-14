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
 * Coverage: portfolio-grid, team, doctor-profile, property-card (single required
 * field per array item — generic table below), service-cards (title + cosmetic
 * description/icon), testimonials (quote + name — bespoke, see below).
 * NOT covered (known gap, deliberately out of scope for GH-1621's audit — that
 * audit was scoped to BLOCK_IMAGE_SPEC blocks; these aren't in it): pricing
 * (`plans[].name`+`.price`, plus a further-nested `plans[].features[].text` —
 * multiple required fields incl. one where a fabricated fallback (a fake price)
 * could mislead a customer, needs its own design decision) and faq
 * (`faqs[].question`+`.answer`, both required). Track as a follow-up issue.
 * booking-widget is separately excluded — required field is `name` on
 * `services[]`, but `aiVisible: false` (not reachable via edit-block) and it
 * doesn't share service-cards' cosmetic shape.
 */

type RequiredFieldRule = { requiredField: string; altFields?: string[]; fallbackPrefix: string }

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
        if (obj[rule.requiredField]) return obj
        const altValue = rule.altFields?.map((f) => obj[f]).find(Boolean)
        const fallback = altValue || `${rule.fallbackPrefix} ${i + 1}`
        return { ...obj, [rule.requiredField]: String(fallback) }
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
        blockData[rule.arrayField] = backfillRequiredField(blockData[rule.arrayField] as unknown[], rule)
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

/** Entry point 2 — last line of defense right before a page's draft is promoted
 *  to published (called from publish/route.ts, NOT from every draft autosave —
 *  see file header for why). Walks every block in a full page layout and
 *  backfills required array-item fields. Returns a NEW array; does not mutate
 *  input. */
export function sanitizeBlocksRequiredFields(blocks: Record<string, unknown>[]): Record<string, unknown>[] {
    return blocks.map((block) => {
        const blockType = typeof block?.blockType === 'string' ? block.blockType : undefined
        if (!blockType) return block
        const copy = { ...block }
        sanitizeBlockRequiredFields(blockType, copy)
        return copy
    })
}
