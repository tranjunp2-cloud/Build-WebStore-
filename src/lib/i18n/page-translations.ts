import 'server-only'

import config from '@payload-config'
import { sql } from 'drizzle-orm'
import { unstable_cache } from 'next/cache'
import { getPayload } from 'payload'
import type { LocaleSlots } from './locale-display'

/** A page's translations, as read; throws when the database can't be read (callers decide what that means). */
async function loadPageTranslations(pageId: string | number, which: 'draft' | 'published'): Promise<LocaleSlots> {
    const id = Number(pageId)
    if (!Number.isFinite(id)) return {}
    const payload = await getPayload({ config })
    const db = payload.db.drizzle as unknown as { execute: (q: unknown) => Promise<{ rows: Array<{ slots: unknown }> }> }
    const query =
        which === 'published'
            ? sql`SELECT published_locale_content AS slots FROM pages WHERE id = ${id} LIMIT 1`
            : sql`SELECT locale_content AS slots FROM pages WHERE id = ${id} LIMIT 1`
    const result = await db.execute(query)
    const slots = result.rows?.[0]?.slots
    return slots && typeof slots === 'object' ? (slots as LocaleSlots) : {}
}

const unreadable = (error: unknown) => {
    // no translations is the page as written — never a broken page
    console.warn('[locale] page translations could not be read', error instanceof Error ? error.message : String(error))
    return {} as LocaleSlots
}

/**
 * A page's translations, raw columns (not Payload fields): `locale_content` is
 * the editor's draft copy (rewritten on every save), `published_locale_content`
 * the copy that went live with the last publish. An unreadable database = none.
 */
export async function readPageTranslations(pageId: string | number, which: 'draft' | 'published'): Promise<LocaleSlots> {
    return loadPageTranslations(pageId, which).catch(unreadable)
}

/**
 * The live translations for visitors, cached with the site (a publish revalidates `site-<id>`). Only a successful
 * read is cached: a failure (a database hiccup) throws inside the cached function, which stores nothing, and is
 * answered with none outside it, so the next visitor reads again.
 */
export function getCachedPublishedTranslations(siteId: string, pageId: string | number): Promise<LocaleSlots> {
    return unstable_cache(() => loadPageTranslations(pageId, 'published'), [`page-translations-v1-${siteId}-${pageId}`], {
        revalidate: 300,
        tags: [`site-${siteId}`],
    })().catch(unreadable)
}
