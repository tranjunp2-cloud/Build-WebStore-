import { sql } from 'drizzle-orm'
import { withoutTemplateCopies } from '@/lib/i18n/template-content'

type Slots = Record<string, Record<string, Record<string, unknown>>>
type Run = (query: ReturnType<typeof sql>) => Promise<{ rows?: Array<Record<string, unknown>> } | undefined>

/** Section id → block type of a page's layout (what tells a section's template text from a translation). */
export function blockTypesOf(layout: unknown): Map<string, string> {
    const types = new Map<string, string>()
    if (!Array.isArray(layout)) return types
    for (const block of layout) {
        const { id, blockType } = (block ?? {}) as { id?: unknown; blockType?: unknown }
        if ((typeof id === 'string' || typeof id === 'number') && typeof blockType === 'string') types.set(String(id), blockType)
    }
    return types
}

/**
 * The pages' translations go live with them: the live site reads `published_locale_content` (`locale_content` is
 * the editor's draft copy, rewritten on every save). A copy that is only the editor's template text is not a
 * translation, so it is left out: visitors get the language the page is written in there, never filler.
 * `run` executes a statement (inside the publish transaction when there is one).
 */
export async function publishTranslations(run: Run, siteId: number, blockTypes: ReadonlyMap<number, ReadonlyMap<string, string>>, brand: string): Promise<void> {
    const result = await run(sql`SELECT id, locale_content FROM pages WHERE site_id = ${siteId} AND deleted_at IS NULL`)
    for (const row of result?.rows ?? []) {
        const id = Number(row.id)
        if (!Number.isFinite(id)) continue
        const raw = row.locale_content
        const slots = raw && typeof raw === 'object' ? withoutTemplateCopies(raw as Slots, blockTypes.get(id) ?? new Map(), brand) : {}
        await run(sql`UPDATE pages SET published_locale_content = ${JSON.stringify(slots)}::jsonb WHERE id = ${id} AND site_id = ${siteId}`)
    }
}
