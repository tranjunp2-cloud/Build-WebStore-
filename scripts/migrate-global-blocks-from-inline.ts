#!/usr/bin/env tsx
/**
 * migrate-global-blocks-from-inline.ts
 *
 * One-shot data migration for the inline→global promotion of global-scoped blocks.
 *
 * WHAT IT DOES:
 *   For each site that has cart-widget, whatsapp-button, or social-widget blocks
 *   placed as `variant = 'inline'` inside page.layout:
 *     1. Takes the FIRST inline block's config as the site's globalBlocks entry
 *        (skipped if globalBlocks already has that key — existing config wins).
 *     2. Deletes ALL inline copies of that blockType from every page of the site.
 *     3. Cleans up draft tables (_pages_v_blocks_*) — deletes all inline rows there too.
 *
 * SAFETY:
 *   - Idempotent: after first run inline rows are gone; subsequent runs find nothing.
 *   - Non-destructive to globalBlocks: only writes to site.global_blocks when the key
 *     is currently null/missing — never overwrites an existing config.
 *   - --dry-run: logs all planned changes without writing anything.
 *
 * USAGE:
 *   tsx --require ./scripts/seed-preload.cjs scripts/migrate-global-blocks-from-inline.ts [--dry-run]
 */

import pg from 'pg'

const DRY_RUN = process.argv.includes('--dry-run')

// ─── DB pool (mirrors db-setup.js createPool) ─────────────────────────────

function createPool(): pg.Pool {
    const connStr = process.env.DATABASE_URI || process.env.DATABASE_URL
    if (!connStr) throw new Error('DATABASE_URI or DATABASE_URL env var is required')

    const sslmodeMatch = connStr.match(/[?&]sslmode=([^&]+)/)
    const sslmode = sslmodeMatch ? sslmodeMatch[1].toLowerCase() : null
    const hostMatch = connStr.match(/@([^:/?]+)/)
    const host = hostMatch ? hostMatch[1].toLowerCase() : ''
    const isLocal = ['localhost', '127.0.0.1', '::1', 'host.docker.internal', 'postgres'].includes(host)
    const useSsl = sslmode === 'disable' ? false : (isLocal ? false : { rejectUnauthorized: false })

    const cleanStr = connStr
        .replace(/[?&]sslmode=[^&]+/g, '')
        .replace(/\?&/, '?')
        .replace(/\?$/, '')

    return new pg.Pool({ connectionString: cleanStr, ssl: useSsl as pg.PoolConfig['ssl'], connectionTimeoutMillis: 10_000 })
}

// ─── Types ────────────────────────────────────────────────────────────────

interface SiteGlobalBlocks {
    cartWidget?: Record<string, unknown> | null
    whatsappButton?: Record<string, unknown> | null
    socialWidget?: Record<string, unknown> | null
}

interface MigrationSummary {
    sitesUpdated: number
    sitesSkipped: number
    inlineRowsDeleted: number
    draftRowsDeleted: number
    errors: string[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function log(msg: string) {
    console.log(`[migrate-global-blocks] ${msg}`)
}

function logDry(msg: string) {
    if (DRY_RUN) console.log(`[DRY-RUN] ${msg}`)
}

// ─── Cart Widget migration ────────────────────────────────────────────────

async function migrateCartWidget(client: pg.PoolClient, summary: MigrationSummary): Promise<void> {
    // Find all inline cart_widget blocks, grouped by site, ordered by page + block order
    const { rows } = await client.query<{
        id: string
        page_id: number
        site_id: number
        label: string | null
        show_label: boolean | null
        global_blocks: SiteGlobalBlocks | null
    }>(`
        SELECT pb.id, pb._parent_id AS page_id,
               p.site_id, pb.label, pb.show_label,
               s.global_blocks
        FROM pages_blocks_cart_widget pb
        JOIN pages p ON p.id = pb._parent_id
        JOIN sites s ON s.id = p.site_id
        WHERE pb.variant = 'inline'
        ORDER BY p.site_id, pb._order
    `)

    if (rows.length === 0) {
        log('cart-widget: no inline blocks found — nothing to migrate')
        return
    }

    log(`cart-widget: found ${rows.length} inline block(s) across sites`)

    // Group by site_id
    const bySite = new Map<number, typeof rows>()
    for (const row of rows) {
        const arr = bySite.get(row.site_id) ?? []
        arr.push(row)
        bySite.set(row.site_id, arr)
    }

    for (const [siteId, siteRows] of bySite) {
        const first = siteRows[0]
        const existing = first.global_blocks?.cartWidget

        if (existing) {
            log(`cart-widget: site ${siteId} already has globalBlocks.cartWidget — skipping config write`)
            summary.sitesSkipped++
        } else {
            const newEntry = {
                blockType: 'cartWidget',
                variant: 'floating',
                label: first.label ?? 'Cart',
                showLabel: first.show_label ?? false,
            }
            logDry(`Would set site ${siteId} globalBlocks.cartWidget = ${JSON.stringify(newEntry)}`)
            if (!DRY_RUN) {
                const currentGlobal = first.global_blocks ?? {}
                const merged = { ...currentGlobal, cartWidget: newEntry }
                await client.query(
                    `UPDATE sites SET global_blocks = $1 WHERE id = $2`,
                    [JSON.stringify(merged), siteId],
                )
                log(`cart-widget: site ${siteId} → globalBlocks.cartWidget set`)
            }
            summary.sitesUpdated++
        }

        // Delete all inline blocks for this site (all pages)
        const blockIds = siteRows.map(r => r.id)
        logDry(`Would delete ${blockIds.length} inline cart_widget row(s) for site ${siteId}`)
        if (!DRY_RUN) {
            const { rowCount } = await client.query(
                `DELETE FROM pages_blocks_cart_widget WHERE id = ANY($1)`,
                [blockIds],
            )
            summary.inlineRowsDeleted += rowCount ?? 0
            log(`cart-widget: site ${siteId} → deleted ${rowCount} inline row(s)`)
        } else {
            summary.inlineRowsDeleted += blockIds.length
        }
    }

    // Clean draft table
    const { rowCount: draftCount } = await (DRY_RUN
        ? client.query(`SELECT COUNT(*) FROM _pages_v_blocks_cart_widget WHERE variant = 'inline'`)
        : client.query(`DELETE FROM _pages_v_blocks_cart_widget WHERE variant = 'inline'`)
    )
    const deleted = DRY_RUN
        ? parseInt((draftCount as unknown as { rows: Array<{ count: string }> })?.rows?.[0]?.count ?? '0')
        : (draftCount ?? 0)
    if (deleted > 0) {
        logDry(`Would delete ${deleted} inline cart_widget draft row(s)`)
        log(`cart-widget drafts: deleted ${DRY_RUN ? '(dry)' : ''} ${deleted} row(s)`)
        summary.draftRowsDeleted += Number(deleted)
    }
}

// ─── WhatsApp Button migration ────────────────────────────────────────────

async function migrateWhatsappButton(client: pg.PoolClient, summary: MigrationSummary): Promise<void> {
    const { rows } = await client.query<{
        id: string
        page_id: number
        site_id: number
        phone_number: string | null
        message: string | null
        label: string | null
        position: string | null
        global_blocks: SiteGlobalBlocks | null
    }>(`
        SELECT pb.id, pb._parent_id AS page_id,
               p.site_id, pb.phone_number, pb.message, pb.label, pb.position,
               s.global_blocks
        FROM pages_blocks_whatsapp_button pb
        JOIN pages p ON p.id = pb._parent_id
        JOIN sites s ON s.id = p.site_id
        WHERE pb.variant = 'inline'
        ORDER BY p.site_id, pb._order
    `)

    if (rows.length === 0) {
        log('whatsapp-button: no inline blocks found — nothing to migrate')
        return
    }

    log(`whatsapp-button: found ${rows.length} inline block(s) across sites`)

    const bySite = new Map<number, typeof rows>()
    for (const row of rows) {
        const arr = bySite.get(row.site_id) ?? []
        arr.push(row)
        bySite.set(row.site_id, arr)
    }

    for (const [siteId, siteRows] of bySite) {
        const first = siteRows[0]
        const existing = first.global_blocks?.whatsappButton

        if (existing) {
            log(`whatsapp-button: site ${siteId} already has globalBlocks.whatsappButton — skipping config write`)
            summary.sitesSkipped++
        } else {
            const newEntry = {
                blockType: 'whatsapp-button',
                variant: 'floating',
                phoneNumber: first.phone_number ?? '',
                message: first.message ?? undefined,
                label: first.label ?? 'Chat with us',
                position: first.position ?? 'bottom-right',
            }
            logDry(`Would set site ${siteId} globalBlocks.whatsappButton = ${JSON.stringify(newEntry)}`)
            if (!DRY_RUN) {
                const currentGlobal = first.global_blocks ?? {}
                const merged = { ...currentGlobal, whatsappButton: newEntry }
                await client.query(
                    `UPDATE sites SET global_blocks = $1 WHERE id = $2`,
                    [JSON.stringify(merged), siteId],
                )
                log(`whatsapp-button: site ${siteId} → globalBlocks.whatsappButton set`)
            }
            summary.sitesUpdated++
        }

        const blockIds = siteRows.map(r => r.id)
        logDry(`Would delete ${blockIds.length} inline whatsapp_button row(s) for site ${siteId}`)
        if (!DRY_RUN) {
            const { rowCount } = await client.query(
                `DELETE FROM pages_blocks_whatsapp_button WHERE id = ANY($1)`,
                [blockIds],
            )
            summary.inlineRowsDeleted += rowCount ?? 0
            log(`whatsapp-button: site ${siteId} → deleted ${rowCount} inline row(s)`)
        } else {
            summary.inlineRowsDeleted += blockIds.length
        }
    }

    // Draft cleanup
    const { rowCount: draftCount } = await (DRY_RUN
        ? client.query(`SELECT COUNT(*) FROM _pages_v_blocks_whatsapp_button WHERE variant = 'inline'`)
        : client.query(`DELETE FROM _pages_v_blocks_whatsapp_button WHERE variant = 'inline'`)
    )
    const deleted = DRY_RUN
        ? parseInt((draftCount as unknown as { rows: Array<{ count: string }> })?.rows?.[0]?.count ?? '0')
        : (draftCount ?? 0)
    if (deleted > 0) {
        logDry(`Would delete ${deleted} inline whatsapp_button draft row(s)`)
        log(`whatsapp-button drafts: deleted ${DRY_RUN ? '(dry)' : ''} ${deleted} row(s)`)
        summary.draftRowsDeleted += Number(deleted)
    }
}

// ─── Social Widget migration ───────────────────────────────────────────────

async function migrateSocialWidget(client: pg.PoolClient, summary: MigrationSummary): Promise<void> {
    // _uuid was added after initial table creation — check before querying.
    const { rows: colCheck } = await client.query<{ exists: boolean }>(`
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = 'pages_blocks_social_widget' AND column_name = '_uuid'
        ) AS exists
    `)
    const hasUuid = colCheck[0]?.exists ?? false

    const uuidSelect = hasUuid ? 'pb._uuid' : 'pb.id AS _uuid'

    const { rows } = await client.query<{
        id: string
        _uuid: string
        page_id: number
        site_id: number
        headline: string | null
        global_blocks: SiteGlobalBlocks | null
    }>(`
        SELECT pb.id, ${uuidSelect}, pb._parent_id AS page_id,
               p.site_id, pb.headline,
               s.global_blocks
        FROM pages_blocks_social_widget pb
        JOIN pages p ON p.id = pb._parent_id
        JOIN sites s ON s.id = p.site_id
        WHERE pb.variant = 'inline'
        ORDER BY p.site_id, pb._order
    `)

    if (rows.length === 0) {
        log('social-widget: no inline blocks found — nothing to migrate')
        return
    }

    log(`social-widget: found ${rows.length} inline block(s) across sites`)

    const bySite = new Map<number, typeof rows>()
    for (const row of rows) {
        const arr = bySite.get(row.site_id) ?? []
        arr.push(row)
        bySite.set(row.site_id, arr)
    }

    for (const [siteId, siteRows] of bySite) {
        const first = siteRows[0]
        const existing = first.global_blocks?.socialWidget

        if (!existing) {
            // Fetch links for the first block via its _uuid
            const { rows: links } = await client.query<{
                platform: string
                url: string
                enabled: boolean
            }>(`
                SELECT platform, url, enabled
                FROM pages_blocks_social_widget_links
                WHERE _parent_id = $1
                ORDER BY _order
            `, [first._uuid])

            const newEntry = {
                blockType: 'socialWidget',
                variant: 'floating',
                headline: first.headline ?? undefined,
                links: links.map(l => ({ platform: l.platform, url: l.url, enabled: l.enabled })),
            }
            logDry(`Would set site ${siteId} globalBlocks.socialWidget = ${JSON.stringify(newEntry)}`)
            if (!DRY_RUN) {
                const currentGlobal = first.global_blocks ?? {}
                const merged = { ...currentGlobal, socialWidget: newEntry }
                await client.query(
                    `UPDATE sites SET global_blocks = $1 WHERE id = $2`,
                    [JSON.stringify(merged), siteId],
                )
                log(`social-widget: site ${siteId} → globalBlocks.socialWidget set (${links.length} links)`)
            }
            summary.sitesUpdated++
        } else {
            log(`social-widget: site ${siteId} already has globalBlocks.socialWidget — skipping config write`)
            summary.sitesSkipped++
        }

        // Delete inline blocks + their child link rows
        const blockUuids = siteRows.map(r => r._uuid)
        const blockIds = siteRows.map(r => r.id)

        logDry(`Would delete ${blockIds.length} inline social_widget row(s) + their links for site ${siteId}`)
        if (!DRY_RUN) {
            await client.query(
                `DELETE FROM pages_blocks_social_widget_links WHERE _parent_id = ANY($1)`,
                [blockUuids],
            )
            const { rowCount } = await client.query(
                `DELETE FROM pages_blocks_social_widget WHERE id = ANY($1)`,
                [blockIds],
            )
            summary.inlineRowsDeleted += rowCount ?? 0
            log(`social-widget: site ${siteId} → deleted ${rowCount} inline row(s) + links`)
        } else {
            summary.inlineRowsDeleted += blockIds.length
        }
    }

    // Draft cleanup — also remove child link rows.
    // _uuid may not exist in the draft table (added after initial creation) — check first.
    const { rows: draftColCheck } = await client.query<{ exists: boolean }>(`
        SELECT EXISTS (
            SELECT 1 FROM information_schema.columns
            WHERE table_name = '_pages_v_blocks_social_widget' AND column_name = '_uuid'
        ) AS exists
    `)
    const draftHasUuid = draftColCheck[0]?.exists ?? false
    const draftUuidSelect = draftHasUuid ? '_uuid' : 'id AS _uuid'

    const { rows: draftBlocks } = await client.query<{ id: string; _uuid: string }>(
        `SELECT id, ${draftUuidSelect} FROM _pages_v_blocks_social_widget WHERE variant = 'inline'`,
    )
    if (draftBlocks.length > 0) {
        logDry(`Would delete ${draftBlocks.length} inline social_widget draft row(s) + their links`)
        if (!DRY_RUN) {
            const draftUuids = draftBlocks.map(r => r._uuid)
            const draftIds = draftBlocks.map(r => r.id)
            await client.query(
                `DELETE FROM _pages_v_blocks_social_widget_links WHERE _parent_id = ANY($1)`,
                [draftUuids],
            )
            await client.query(
                `DELETE FROM _pages_v_blocks_social_widget WHERE id = ANY($1)`,
                [draftIds],
            )
            log(`social-widget drafts: deleted ${draftBlocks.length} row(s)`)
        }
        summary.draftRowsDeleted += draftBlocks.length
    }
}

// ─── Main ─────────────────────────────────────────────────────────────────

// Run a single migration function in its own transaction.
// Failures are isolated — other migrations continue regardless.
async function runIsolated(
    pool: pg.Pool,
    label: string,
    fn: (client: pg.PoolClient, summary: MigrationSummary) => Promise<void>,
    summary: MigrationSummary,
): Promise<void> {
    const client = await pool.connect()
    try {
        if (!DRY_RUN) await client.query('BEGIN')
        await fn(client, summary)
        if (!DRY_RUN) await client.query('COMMIT')
    } catch (err) {
        if (!DRY_RUN) await client.query('ROLLBACK')
        const msg = err instanceof Error ? err.message : String(err)
        summary.errors.push(`${label}: ${msg}`)
        console.error(`[migrate-global-blocks] ERROR in ${label} — rolled back: ${msg}`)
    } finally {
        client.release()
    }
}

async function main() {
    if (DRY_RUN) log('DRY-RUN mode — no writes will be made')

    const pool = createPool()

    const summary: MigrationSummary = {
        sitesUpdated: 0,
        sitesSkipped: 0,
        inlineRowsDeleted: 0,
        draftRowsDeleted: 0,
        errors: [],
    }

    await runIsolated(pool, 'cart-widget', migrateCartWidget, summary)
    await runIsolated(pool, 'whatsapp-button', migrateWhatsappButton, summary)
    await runIsolated(pool, 'social-widget', migrateSocialWidget, summary)

    await pool.end()

    log('─── Summary ───────────────────────────────────────')
    log(`Sites updated (globalBlocks written) : ${summary.sitesUpdated}`)
    log(`Sites skipped (globalBlocks existed)  : ${summary.sitesSkipped}`)
    log(`Inline page rows deleted              : ${summary.inlineRowsDeleted}`)
    log(`Inline draft rows deleted             : ${summary.draftRowsDeleted}`)
    if (summary.errors.length) {
        log(`Errors                               : ${summary.errors.length}`)
        for (const e of summary.errors) log(`  ✗ ${e}`)
        process.exit(1)
    } else {
        log('Migration completed successfully.')
        process.exit(0)
    }
}

main()
