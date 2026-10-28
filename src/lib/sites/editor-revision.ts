import type { Payload } from 'payload'
import { sql } from 'drizzle-orm'
import { executeTenantTransaction, type TenantTransactionRequest } from '@/lib/payload/tenant-row-lock'

/**
 * Editor draft revision — a counter on the site (theme, menu, footer) and on
 * each page (layout, language slots) that every content write bumps: an
 * editor save, an approved copilot change. The editor sends the revision it
 * loaded as `base` with each save; a save made from an older revision is
 * refused (409 DRAFT_CHANGED) instead of overwriting what was written since —
 * another tab's edits, or a copilot change approved elsewhere. A save without
 * `base` (older clients) is let through.
 *
 * Raw columns (`sites.editor_revision`, `pages.editor_revision`, see
 * scripts/db-setup.js), not Payload fields: Payload writes never touch them.
 */

export type EditorRevision = { site: number; page: number | null }
type Exec = (query: ReturnType<typeof sql>) => Promise<{ rows?: Array<Record<string, unknown>> } | undefined>

/** Raw SQL inside the tenant transaction (same session as the Payload writes). */
export const txExec = (payload: Payload, req: TenantTransactionRequest): Exec => (query) => executeTenantTransaction(payload, req, query)

/** Raw SQL on the pool (reads outside a transaction, e.g. editor-data). */
export const poolExec = (payload: Payload): Exec => (query) =>
    (payload.db as unknown as { drizzle: { execute: Exec } }).drizzle.execute(query)

export function formatDraftVersion(revision: EditorRevision): string {
    return `${revision.site}.${revision.page ?? 0}`
}

export function parseDraftVersion(value: unknown): EditorRevision | null {
    if (typeof value !== 'string') return null
    const match = /^(\d{1,9})\.(\d{1,9})$/.exec(value)
    return match ? { site: Number(match[1]), page: Number(match[2]) } : null
}

/**
 * The parts a save would overwrite that changed since its base: the site part
 * when it writes the theme / menu / footer, the page part when it writes the
 * layout or the language slots. No base → nothing is stale (let through).
 */
export function staleParts(
    base: EditorRevision | null,
    current: EditorRevision,
    writes: { site: boolean; page: boolean },
): Array<'site' | 'page'> {
    if (!base) return []
    const stale: Array<'site' | 'page'> = []
    if (writes.site && base.site !== current.site) stale.push('site')
    if (writes.page && current.page !== null && (base.page ?? 0) !== current.page) stale.push('page')
    return stale
}

export async function readEditorRevision(exec: Exec, siteId: number, pageId: number | null): Promise<EditorRevision> {
    const site = await exec(sql`SELECT editor_revision FROM sites WHERE id = ${siteId}`)
    const page = pageId === null ? null : await exec(sql`SELECT editor_revision FROM pages WHERE id = ${pageId} AND site_id = ${siteId}`)
    return {
        site: Number(site?.rows?.[0]?.editor_revision ?? 0),
        page: pageId === null ? null : Number(page?.rows?.[0]?.editor_revision ?? 0),
    }
}

/** Bumps the revision of what a write changed (call inside the write's transaction). */
export async function bumpEditorRevision(exec: Exec, siteId: number, parts: { site?: boolean; pageIds?: Array<number | string> }): Promise<void> {
    if (parts.site) await exec(sql`UPDATE sites SET editor_revision = editor_revision + 1 WHERE id = ${siteId}`)
    const pageIds = (parts.pageIds ?? []).map(Number).filter((id) => Number.isSafeInteger(id) && id > 0)
    for (const pageId of pageIds) {
        await exec(sql`UPDATE pages SET editor_revision = editor_revision + 1 WHERE id = ${pageId} AND site_id = ${siteId}`)
    }
}

/** The 409 a stale save gets; the editor stops autosaving and offers a reload. */
export class DraftChangedError extends Error {
    readonly current: EditorRevision
    readonly parts: Array<'site' | 'page'>

    constructor(current: EditorRevision, parts: Array<'site' | 'page'>) {
        super('This page was changed somewhere else since you opened it. Reload to get the latest version.')
        this.name = 'DraftChangedError'
        this.current = current
        this.parts = parts
    }
}
