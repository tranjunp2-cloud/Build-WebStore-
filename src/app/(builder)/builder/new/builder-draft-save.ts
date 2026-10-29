/**
 * The builder's save of what the merchant changed after generation (reorder, theme) — a DRAFT save.
 *
 * #2103 A4: the builder used to send only `{ blocks, theme }`, which the save route stores as
 * `draft: isDraft ?? false`, i.e. it published the page the merchant had only rearranged. It now sends
 * `isDraft: true` and the draft revision (`base`) exactly like the editor (lib/editor/save-payload), so a
 * save made from an older draft is refused instead of silently overwriting a newer one.
 *
 * The builder never loads the editor data, so it learns the revision once per site from `editor-data`,
 * then keeps the one each save returns (`x-draft-version`).
 */

import { draftBase } from '@/lib/editor/save-payload'

export type BuilderDraftBase = {
    siteId: string | null
    /** The draft revision to send as `base`; null → none known, the save goes through unchecked. */
    version: string | null
    /** The revision was looked up for `siteId` (a failed lookup is not retried on every save). */
    loaded: boolean
    /**
     * A save was refused because the draft changed elsewhere. The newer revision is now the base, so a
     * save would silently overwrite the other draft: autosave stays paused until the merchant saves on purpose.
     */
    conflicted: boolean
}

export const createBuilderDraftBase = (): BuilderDraftBase => ({ siteId: null, version: null, loaded: false, conflicted: false })

/** Autosave must not run (an explicit save still can) while a refused save is unresolved. */
export const isAutosavePaused = (holder: BuilderDraftBase): boolean => holder.conflicted

export type BuilderDraftSaveResult = { ok: true } | { ok: false; conflict: boolean; paused?: boolean }

export type BuilderDraftSaveOptions = {
    /** The merchant asked for this save (Save / Publish): it goes through after a conflict, with the newer revision as base. */
    explicit?: boolean
}

type DraftSaveState = { blocks: unknown[]; theme: unknown }

/** The body of a builder draft save. */
export function buildBuilderSaveBody(state: DraftSaveState, version: string | null): Record<string, unknown> {
    return {
        blocks: state.blocks,
        theme: state.theme,
        isDraft: true,
        ...draftBase({ draftVersion: version }),
    }
}

/** The current draft revision of the site's homepage (what the save route also resolves without a pageId). */
async function loadDraftVersion(siteId: string): Promise<string | null> {
    try {
        const res = await fetch(`/api/sites/${siteId}/editor-data`, { credentials: 'include' })
        if (!res.ok) return null
        const data = await res.json().catch(() => null) as { draftVersion?: unknown } | null
        return typeof data?.draftVersion === 'string' ? data.draftVersion : null
    } catch {
        return null
    }
}

/** The revision a refused save (409 DRAFT_CHANGED) was refused against, else undefined. */
async function readConflict(res: Response): Promise<{ draftVersion: string | null } | undefined> {
    if (res.status !== 409) return undefined
    const body = await res.json().catch(() => null) as { code?: unknown; draftVersion?: unknown } | null
    if (body?.code !== 'DRAFT_CHANGED') return undefined
    return { draftVersion: typeof body.draftVersion === 'string' ? body.draftVersion : null }
}

/**
 * Saves the builder's blocks + theme as a draft. A refused save (the draft changed elsewhere) is not
 * retried on its own: the newer revision is kept so the merchant's next EXPLICIT save, made knowingly, goes
 * through; automatic saves are paused until then (they would overwrite the other draft without being asked).
 */
export async function saveBuilderDraft(
    siteId: string,
    state: DraftSaveState,
    holder: BuilderDraftBase,
    options: BuilderDraftSaveOptions = {},
): Promise<BuilderDraftSaveResult> {
    if (holder.siteId !== siteId) {
        holder.siteId = siteId
        holder.version = null
        holder.loaded = false
        holder.conflicted = false
    }
    if (holder.conflicted && !options.explicit) return { ok: false, conflict: true, paused: true }
    if (!holder.loaded) {
        holder.version = await loadDraftVersion(siteId)
        holder.loaded = true
    }

    const res = await fetch(`/api/sites/${siteId}/save`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildBuilderSaveBody(state, holder.version)),
    })

    if (res.ok) {
        const version = res.headers?.get('x-draft-version')
        if (version) holder.version = version
        holder.conflicted = false
        return { ok: true }
    }

    const conflict = await readConflict(res)
    if (conflict) {
        if (conflict.draftVersion) holder.version = conflict.draftVersion
        holder.conflicted = true
        return { ok: false, conflict: true }
    }
    return { ok: false, conflict: false }
}
