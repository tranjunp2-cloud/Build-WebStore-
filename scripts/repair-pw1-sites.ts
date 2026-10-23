/**
 * Repairs already migrated PW1 sites in place, without regenerating them (no AI call, no new layout):
 *   footer  - applies the binder rule (brand info + 3 or more link columns => dark-gradient) to
 *             sites.footer_block / pending_footer_block; only the variant changes, dark-gradient footers are skipped.
 *   hero    - hero banners on a variant that hides their image (fullscreen/gradient/minimal) move to one that shows it.
 *   product-grids - fixed product listings without items become "all products", as PW1 shows them.
 *   links   - (needs --input) footer columns whose hyperlinks were flattened to plain text get their links back.
 *   placeholders - (needs --input) images that were replaced by the neutral placeholder are downloaded again from PW1
 *             and every reference (block fields, drafts, slide JSON) is pointed at the real media. Rich-text <img> placeholders
 *             get the real media too, or, for images hotlinked from other sites, their original URL back.
 *   images  - rich-text (custom-html) <img> tags still pointing at PW1 storage (DigitalOcean Spaces) are rehosted into
 *             destination media with the migration's own downloader. Images from other sites keep their URL.
 *
 *   npm run migrate:pw1:repair                          # writes: every completed store, all repairs (npm script passes --apply)
 *   npm run migrate:pw1:repair -- --dry-run             # only list what would change
 *   npm run migrate:pw1:repair -- --store 2898          # one store
 *   npm run migrate:pw1:repair -- --only images         # one repair only (footer | hero | images)
 * Input for links/placeholders defaults to PW1_REPAIR_INPUT, else every master part of every completed run in .migration/runs, each store matched by the input hash recorded in the DB. Previous values are backed up before every write.
 */
import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { parseArgs } from 'node:util'
import { Client } from 'pg'
import type { Payload } from 'payload'
import { adaptWebsiteInput } from '../src/lib/migration/pw2-website-input'
import { batchEntryHash, compactInput, type BatchEntry } from '../src/lib/migration/pw1-batch-input'
import { validateMigrationBatch } from '../src/lib/migration/pw1-batch-validation'
import { discoverAllPreparedParts } from '../src/lib/migration/pw1-prepared-input'
import { repairFooterLinks } from '../src/lib/migration/pw1-footer-links-repair'
import { isMediaReferenced, repointMedia } from '../src/lib/migration/pw1-media-repoint'
import { isPw1StorageUrl } from '../src/lib/migration/pw1-image-origin'
import { htmlImageUrls, htmlMediaNamePrefix, htmlPlaceholders, isHtmlImageInUse, swapHtmlImageSource, type HtmlMedia } from '../src/lib/migration/pw1-html-placeholder-repair'
import { PLACEHOLDER_MEDIA_WHERE, isPlaceholderMedia, placeholderCandidates, placeholderMediaPattern, sourceUrls } from '../src/lib/migration/pw1-placeholder-image-repair'
import { hasDeliberateEmptySelection, repairProductGrid } from '../src/lib/migration/pw1-product-grid-repair'
import { repairHeroVariant } from '../src/lib/migration/pw1-hero-variant-repair'
import { repairFooterVariant } from '../src/lib/migration/pw1-footer-variant-repair'
import { externalImageUrls, repairRichTextImages } from '../src/lib/migration/pw1-richtext-image-repair'

type Store = {
    source_store_id: string; site_id: number; tenant_id: number; input_hash: string | null
    footer_block: unknown; pending_footer_block: unknown
    seo_meta_description: string | null
    contact_info_phone: string | null; contact_info_email: string | null; contact_info_address: string | null
}
type HtmlBlock = { id: string; page_id: number; html: string }
/** Appends each previous value (one JSON line) to the backup file before it is overwritten, so a crash never loses a restore point. */
type Backup = { add(entry: Record<string, unknown>): Promise<void>; file?: string }
function createBackup(dir: string): Backup {
    const file = resolve(dir, `before-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`)
    const backup: Backup = {
        async add(entry) {
            await mkdir(dir, { recursive: true })
            await appendFile(file, `${JSON.stringify(entry)}\n`)
            backup.file = file
        },
    }
    return backup
}

type FooterColumn = 'footer_block' | 'pending_footer_block'
type FooterChange = { row: Store; column: FooterColumn; footer: unknown; note: string }

async function writeFooters(client: Client, changes: FooterChange[], apply: boolean, backup: Backup, label: string, checked: number) {
    for (const { row, column, note } of changes) console.log(`[${label}] store ${row.source_store_id} site ${row.site_id} ${column}: ${note}`)
    console.log(`[${label}] ${checked} completed store(s) checked, ${changes.length} footer(s) need repair`)
    if (!apply) return
    let updated = 0
    for (const { row, column, footer } of changes) {
        await backup.add({ kind: label, siteId: row.site_id, storeId: row.source_store_id, column, before: row[column] })
        // The previous JSON is part of the WHERE clause, so a footer edited since the read is skipped, not overwritten.
        const result = await client.query(
            `UPDATE sites SET ${column} = $2::jsonb, updated_at = now() WHERE id = $1 AND ${column} = $3::jsonb`,
            [row.site_id, JSON.stringify(footer), JSON.stringify(row[column])])
        if (result.rowCount === 1) { updated++; row[column] = footer }
        else console.warn(`[${label}] site ${row.site_id} ${column} changed while running; skipped`)
    }
    console.log(`[${label}] updated ${updated}/${changes.length}`)
}

async function repairFooters(client: Client, stores: Store[], apply: boolean, backup: Backup) {
    const site = (row: Store) => ({ metaDescription: row.seo_meta_description, phone: row.contact_info_phone, email: row.contact_info_email, address: row.contact_info_address })
    const changes = stores.flatMap(row => (['footer_block', 'pending_footer_block'] as const).flatMap(column => {
        const repair = repairFooterVariant(row[column], site(row))
        return repair.changed ? [{ row, column, footer: repair.footer, note: `${repair.from} -> ${repair.to}` }] : []
    }))
    await writeFooters(client, changes, apply, backup, 'footer', stores.length)
}

async function repairFooterLinkColumns(client: Client, stores: Store[], sources: Sources, apply: boolean, backup: Backup) {
    const changes = stores.flatMap(row => {
        const columns = sources.get(row.source_store_id)?.footerColumns
        if (!columns) return []
        return (['footer_block', 'pending_footer_block'] as const).flatMap(column => {
            const repair = repairFooterLinks(row[column], columns)
            return repair.changed ? [{ row, column, footer: repair.footer, note: `links restored in ${repair.columns.map(c => `"${c}"`).join(', ')}` }] : []
        })
    })
    await writeFooters(client, changes, apply, backup, 'links', stores.filter(row => sources.has(row.source_store_id)).length)
}

type HeroRow = { id: string; page_id: number; variant: string; image_id: number | null }

async function repairHeroes(client: Client, stores: Store[], apply: boolean, backup: Backup) {
    let found = 0, updated = 0
    for (const store of stores) {
        const { rows } = await client.query<HeroRow>(
            `SELECT h.id, h._parent_id AS page_id, h.variant, h.image_id FROM pages_blocks_hero h JOIN pages p ON p.id = h._parent_id
             WHERE p.site_id = $1 AND h.variant IN ('fullscreen', 'gradient', 'minimal') AND h.image_id IS NOT NULL`, [store.site_id])
        for (const row of rows) {
            const repair = repairHeroVariant({ variant: row.variant, imageId: row.image_id })
            if (!repair.changed) continue
            found++
            console.log(`[hero] store ${store.source_store_id} page ${row.page_id} block ${row.id}: ${repair.from} -> ${repair.to}`)
            if (!apply) continue
            await backup.add({ kind: 'hero', siteId: store.site_id, storeId: store.source_store_id, pageId: row.page_id, blockId: row.id, before: row.variant })
            const current = await client.query('UPDATE pages_blocks_hero SET variant = $2 WHERE id = $1 AND variant = $3', [row.id, repair.to, row.variant])
            await client.query('UPDATE _pages_v_blocks_hero v SET variant = $2 FROM _pages_v pv WHERE v._parent_id = pv.id AND pv.parent_id = $1 AND v.variant = $3 AND v.image_id IS NOT NULL', [row.page_id, repair.to, row.variant])
            if (current.rowCount === 1) updated++
            else console.warn(`[hero] block ${row.id} changed while running; skipped`)
        }
    }
    console.log(apply ? `[hero] updated ${updated}/${found} hero(es)` : `[hero] ${found} hero(es) hide their image (dry-run)`)
}

async function repairProductGrids(client: Client, stores: Store[], apply: boolean, backup: Backup) {
    let found = 0, updated = 0
    for (const store of stores) {
        const { rows: attempts } = await client.query<{ warnings: string[] | null }>(
            `SELECT a.artifacts->'warnings.json' AS warnings FROM pw1_migration_attempts a WHERE a.source_store_id = $1 AND a.status = 'completed' ORDER BY a.started_at DESC LIMIT 1`, [store.source_store_id])
        if (hasDeliberateEmptySelection(attempts[0]?.warnings ?? [])) { console.log(`[product-grids] store ${store.source_store_id}: skipped, an empty selection was deliberate (see its migration warnings)`); continue }
        const { rows } = await client.query<{ id: string; page_id: number; selection_mode: string; selected_product_ids: unknown }>(
            `SELECT g.id, g._parent_id AS page_id, g.selection_mode, g.selected_product_ids FROM pages_blocks_products_grid g JOIN pages p ON p.id = g._parent_id
             WHERE p.site_id = $1 AND g.selection_mode = 'fixed' AND coalesce(jsonb_array_length(g.selected_product_ids::jsonb), 0) = 0`, [store.site_id])
        for (const row of rows) {
            if (!repairProductGrid({ selectionMode: row.selection_mode, selectedProductIds: row.selected_product_ids }).changed) continue
            found++
            console.log(`[product-grids] store ${store.source_store_id} page ${row.page_id} block ${row.id}: fixed (no products) -> all`)
            if (!apply) continue
            await backup.add({ kind: 'product-grids', siteId: store.site_id, storeId: store.source_store_id, pageId: row.page_id, blockId: row.id, before: row.selection_mode })
            const current = await client.query(`UPDATE pages_blocks_products_grid SET selection_mode = 'all' WHERE id = $1 AND selection_mode = 'fixed'`, [row.id])
            await client.query(`UPDATE _pages_v_blocks_products_grid v SET selection_mode = 'all' FROM _pages_v pv WHERE v._parent_id = pv.id AND pv.parent_id = $1 AND v.selection_mode = 'fixed' AND coalesce(jsonb_array_length(v.selected_product_ids::jsonb), 0) = 0`, [row.page_id])
            if (current.rowCount === 1) updated++
            else console.warn(`[product-grids] block ${row.id} changed while running; skipped`)
        }
    }
    console.log(apply ? `[product-grids] updated ${updated}/${found} grid(s)` : `[product-grids] ${found} grid(s) show nothing but PW1 lists every product (dry-run)`)
}

async function loadHtmlBlocks(client: Client, siteId: number) {
    const { rows } = await client.query<HtmlBlock>(
        `SELECT b.id, b._parent_id AS page_id, b.html FROM pages_blocks_custom_html b JOIN pages p ON p.id = b._parent_id
         WHERE p.site_id = $1 AND b.html ILIKE '%<img%'`, [siteId])
    return rows
}

async function openPayload(): Promise<Payload> {
    // The CLI-only Chromium fallback is registered here because the media module is shared with web routes.
    const [{ registerBrowserImageFetcher }, { fetchImageViaBrowser }] = await Promise.all([import('../src/lib/migration/pw1-media'), import('../src/lib/migration/pw1-media-browser')])
    registerBrowserImageFetcher(fetchImageViaBrowser)
    const { getPayload } = await import('payload')
    const { default: config } = await import('@payload-config')
    return getPayload({ config })
}

async function repairImages(client: Client, stores: Store[], apply: boolean, backup: Backup) {
    let payload: Payload | undefined
    let blocksChanged = 0, imagesFound = 0, imagesLeft = 0
    for (const store of stores) {
        const cache = new Map<string, number>()
        for (const block of await loadHtmlBlocks(client, store.site_id)) {
            const urls = externalImageUrls(block.html)
            if (urls.length === 0) continue
            imagesFound += urls.length
            if (!apply) { console.log(`[images] store ${store.source_store_id} page ${block.page_id} block ${block.id}: ${urls.length} image(s) still on PW1\n    ${urls.join('\n    ')}`); continue }
            payload ??= await openPayload()
            const repair = await repairRichTextImages(block.html, store.tenant_id, payload, cache)
            imagesLeft += repair.remaining
            console.log(`[images] store ${store.source_store_id} page ${block.page_id} block ${block.id}: ${repair.found - repair.remaining}/${repair.found} rehosted${repair.remaining ? `, ${repair.remaining} could not be downloaded` : ''}`)
            if (!repair.changed) continue
            await backup.add({ kind: 'html', siteId: store.site_id, storeId: store.source_store_id, pageId: block.page_id, blockId: block.id, before: block.html })
            // Current page, then its draft versions that still carry the same html; a block edited since the read is skipped.
            const current = await client.query('UPDATE pages_blocks_custom_html SET html = $2 WHERE id = $1 AND html = $3', [block.id, repair.html, block.html])
            await client.query('UPDATE _pages_v_blocks_custom_html v SET html = $2 FROM _pages_v pv WHERE v._parent_id = pv.id AND pv.parent_id = $1 AND v.html = $3', [block.page_id, repair.html, block.html])
            if (current.rowCount === 1) blocksChanged++
            else console.warn(`[images] block ${block.id} changed while running; skipped`)
        }
    }
    console.log(apply
        ? `[images] ${blocksChanged} block(s) updated; ${imagesLeft} of ${imagesFound} image(s) could not be downloaded (broken at the source)`
        : `[images] ${imagesFound} image(s) still point at PW1 (dry-run: nothing downloaded)`)
}

type Sources = Map<string, { footerColumns: Array<{ title?: string; text?: string; links?: Array<{ label: string; url?: string; imageUrl?: string }> }>; urls: Set<string>; htmlImages: Set<string> }>

/**
 * The PW1 export, adapted exactly as the migration does it (no AI, no network), keyed by PW1 store ID.
 * A store takes the input entry whose hash equals the hash the migration recorded for it; when none does (the
 * export was prepared again after the migration) it takes the newest entry for that store. The per-store guards
 * (column title, fewer links, placeholder file name derived from the source URL) keep a fallback harmless.
 */
async function loadSources(files: string[], stores: Store[]): Promise<Sources> {
    const wanted = new Map(stores.map(store => [store.source_store_id, store.input_hash]))
    const chosen = new Map<string, { entry: BatchEntry; exact: boolean }>()
    for (const file of files) {
        const parsed = validateMigrationBatch(JSON.parse(await readFile(resolve(file), 'utf8')))
        for (const entry of parsed.entries) {
            if (!wanted.has(entry.sourceStoreId) || chosen.get(entry.sourceStoreId)?.exact) continue
            const exact = batchEntryHash(entry) === wanted.get(entry.sourceStoreId)
            if (exact || !chosen.has(entry.sourceStoreId)) chosen.set(entry.sourceStoreId, { entry, exact })
        }
    }
    const sources: Sources = new Map()
    for (const [id, { entry }] of chosen) {
        try {
            const { contract } = adaptWebsiteInput(compactInput(entry))
            sources.set(id, { footerColumns: (contract.site.footer as { columns?: never[] }).columns ?? [], urls: sourceUrls(contract), htmlImages: htmlImageUrls(contract) })
        } catch (error) { console.warn(`[input] store ${id} skipped: ${error instanceof Error ? error.message : error}`) }
    }
    const exactCount = [...chosen.values()].filter(c => c.exact).length
    const missing = [...wanted.keys()].filter(id => !chosen.has(id))
    console.log(`[input] ${sources.size}/${wanted.size} store(s) have a PW1 source (${exactCount} exact input hash, ${chosen.size - exactCount} newest entry) from ${files.length} file(s)`)
    if (missing.length) console.warn(`[input] ${missing.length} store(s) not found in any input, left out of links/placeholders: ${missing.slice(0, 20).join(', ')}${missing.length > 20 ? ' ...' : ''}`)
    return sources
}

/** --input / PW1_REPAIR_INPUT else every master part of every completed run in .migration/runs. */
async function resolveInputFiles(input?: string): Promise<string[]> {
    const explicit = input ?? process.env.PW1_REPAIR_INPUT
    if (explicit) return [explicit]
    try {
        const { parts, skipped } = await discoverAllPreparedParts()
        for (const run of skipped) console.warn(`[input] run skipped: ${run.directory}: ${run.reason}`)
        return parts.map(part => part.path)
    } catch (error) {
        console.warn(`[input] no PW1 export found: ${error instanceof Error ? error.message : error}`)
        return []
    }
}

async function repairPlaceholders(client: Client, stores: Store[], sources: Sources, apply: boolean, backup: Backup) {
    let payload: Payload | undefined
    let found = 0, restored = 0, broken = 0
    for (const store of stores) {
        const source = sources.get(store.source_store_id)
        if (!source) continue
        const { rows } = await client.query<{ id: number; filename: string; url: string | null }>(
            `SELECT id, filename, url FROM media WHERE ${PLACEHOLDER_MEDIA_WHERE}`, [placeholderMediaPattern(store.tenant_id)])
        const urlById = new Map(rows.map(row => [row.id, row.url]))
        for (const { url, placeholder } of placeholderCandidates(source.urls, store.tenant_id, rows)) {
            // Already repointed by an earlier run: nothing uses the placeholder any more, so don't download again
            if (!(await isMediaReferenced((text, params) => client.query(text, params), { id: placeholder.id, url: urlById.get(placeholder.id) }))) continue
            found++
            if (!apply) { console.log(`[placeholders] store ${store.source_store_id}: media ${placeholder.id} is a placeholder for\n    ${url}`); continue }
            payload ??= await openPayload()
            const { restorePw1Media } = await import('../src/lib/migration/pw1-media')
            const mediaId = await restorePw1Media(payload, store.tenant_id, url, new URL(url).pathname.split('/').pop() || 'PW1 image').catch(() => undefined)
            const [from, to] = mediaId && mediaId !== placeholder.id
                ? await Promise.all([placeholder.id, mediaId].map(id => payload!.findByID({ collection: 'media', id, depth: 0 })))
                : [undefined, undefined]
            // A source that is still unusable comes back as another placeholder: count it as broken, leave the site as it is
            if (!from || !to || isPlaceholderMedia(to)) { broken++; console.log(`[placeholders] store ${store.source_store_id}: ${url} cannot be downloaded (broken at the source)`); continue }
            await backup.add({ kind: 'placeholder', storeId: store.source_store_id, fromId: from.id, fromUrl: from.url, toId: to.id, toUrl: to.url })
            await client.query('BEGIN')
            try {
                const updated = await repointMedia((text, params) => client.query(text, params), { id: Number(from.id), url: from.url }, { id: Number(to.id), url: to.url })
                await client.query('COMMIT')
                restored++
                console.log(`[placeholders] store ${store.source_store_id}: media ${from.id} -> ${to.id} (${updated} reference(s) updated)`)
            } catch (error) { await client.query('ROLLBACK'); throw error }
        }
    }
    console.log(apply ? `[placeholders] ${restored}/${found} image(s) restored; ${broken} broken at the source` : `[placeholders] ${found} image(s) are still placeholders (dry-run: nothing downloaded)`)
}

/** Rich-text images that differ from PW1: images hotlinked from other sites get their original URL back whatever copy the migration made (they are never copied); PW1 storage ones that ended as the placeholder are downloaded again. */
async function repairHtmlPlaceholders(client: Client, stores: Store[], sources: Sources, apply: boolean, backup: Backup) {
    let payload: Payload | undefined
    let found = 0, restored = 0, broken = 0
    for (const store of stores) {
        const source = sources.get(store.source_store_id)
        if (!source?.htmlImages.size) continue
        const prefixes = [...source.htmlImages].map(url => `${htmlMediaNamePrefix(store.tenant_id, url)}%`)
        const { rows } = await client.query<HtmlMedia>(`SELECT filename, url, width, height, filesize FROM media WHERE filename LIKE ANY($1)`, [prefixes])
        for (const { url, placeholderUrl } of htmlPlaceholders(source.htmlImages, store.tenant_id, rows)) {
            // Already swapped back by an earlier run: no block shows the copy any more
            if (!(await isHtmlImageInUse((text, params) => client.query(text, params), store.site_id, placeholderUrl))) continue
            found++
            const own = isPw1StorageUrl(url)
            if (!apply) { console.log(`[html-placeholders] store ${store.source_store_id}: ${own ? 'PW1 storage image is downloaded again' : 'original URL is put back'}\n    ${url}`); continue }
            let target = url
            if (own) {
                payload ??= await openPayload()
                const { restorePw1Media } = await import('../src/lib/migration/pw1-media')
                const mediaId = await restorePw1Media(payload, store.tenant_id, url.replace(/^http:\/\//i, 'https://'), new URL(url).pathname.split('/').pop() || 'PW1 image').catch(() => undefined)
                const media = mediaId ? await payload.findByID({ collection: 'media', id: mediaId, depth: 0 }) : undefined
                if (!media?.url || media.url === placeholderUrl || isPlaceholderMedia(media)) { broken++; console.log(`[html-placeholders] store ${store.source_store_id}: ${url} cannot be downloaded (broken at the source)`); continue }
                target = media.url
            }
            const updated = await swapHtmlImageSource((text, params) => client.query(text, params), store.site_id, placeholderUrl, target,
                block => backup.add({ kind: 'html-placeholder', siteId: store.site_id, storeId: store.source_store_id, pageId: block.page_id, blockId: block.id, before: block.html }))
            restored++
            console.log(`[html-placeholders] store ${store.source_store_id}: ${url} -> ${updated} block(s) updated`)
        }
    }
    console.log(apply ? `[html-placeholders] ${restored}/${found} image(s) restored; ${broken} broken at the source` : `[html-placeholders] ${found} rich-text image(s) are still placeholders (dry-run: nothing changed)`)
}

async function main() {
    const { values } = parseArgs({ options: { apply: { type: 'boolean' }, 'dry-run': { type: 'boolean' }, store: { type: 'string' }, only: { type: 'string' }, input: { type: 'string' }, 'backup-dir': { type: 'string' }, help: { type: 'boolean' } }, strict: true })
    if (values.help) {
        console.log('Usage: npm run migrate:pw1:repair -- [--store PW1_STORE_ID] [--only footer|hero|product-grids|links|placeholders|images] [--input PW1_EXPORT.json (default: completed runs in .migration/runs)] [--dry-run] [--backup-dir DIR]\nWrites by default; --dry-run lists changes only. Writes after saving the previous values to a backup JSON.')
        return
    }
    if (values.store && !/^\d+$/.test(values.store)) throw new Error('store must be a numeric PW1 store ID')
    if (values.only && !['footer', 'hero', 'product-grids', 'links', 'placeholders', 'images'].includes(values.only)) throw new Error('--only must be footer, hero, product-grids, links, placeholders or images')
    const url = process.env.DATABASE_URI
    if (!url) throw new Error('DATABASE_URI is required')
    const client = new Client({ connectionString: url })
    await client.connect()
    try {
        const apply = Boolean(values.apply) && !values['dry-run']
        console.log(`${apply ? 'APPLY' : 'DRY-RUN'} on ${new URL(url).host}`)
        const { rows: stores } = await client.query<Store>(
            `SELECT m.source_store_id, m.input_hash, m.site_id, m.tenant_id, s.footer_block, s.pending_footer_block, s.seo_meta_description,
                    s.contact_info_phone, s.contact_info_email, s.contact_info_address
             FROM pw1_migration_stores m JOIN sites s ON s.id = m.site_id
             WHERE m.status = 'completed' ${values.store ? 'AND m.source_store_id = $1' : ''}
             ORDER BY m.site_id`, values.store ? [values.store] : [])
        const backup = createBackup(resolve(values['backup-dir'] ?? '.migration/site-repair'))
        const run = (name: string) => !values.only || values.only === name
        if (run('footer')) await repairFooters(client, stores, apply, backup)
        const needsSources = run('links') || run('placeholders')
        const inputFiles = needsSources ? await resolveInputFiles(values.input) : []
        if (needsSources && inputFiles.length === 0 && (values.only === 'links' || values.only === 'placeholders')) throw new Error(`--only ${values.only} needs the PW1 export: run migrate first or pass --input FILE`)
        const sources = inputFiles.length > 0 ? await loadSources(inputFiles, stores) : undefined
        if (!sources && needsSources) console.log('[links] [placeholders] skipped: no PW1 export found (run migrate first or pass --input FILE)')
        if (sources && run('links')) await repairFooterLinkColumns(client, stores, sources, apply, backup)
        if (sources && run('placeholders')) await repairPlaceholders(client, stores, sources, apply, backup)
        if (sources && run('placeholders')) await repairHtmlPlaceholders(client, stores, sources, apply, backup)
        if (run('product-grids')) await repairProductGrids(client, stores, apply, backup)
        if (run('hero')) await repairHeroes(client, stores, apply, backup)
        if (run('images')) await repairImages(client, stores, apply, backup)
        if (backup.file) console.log(`Backup saved: ${backup.file}`)
    } finally { await client.end() }
}

main().then(() => process.exit(0), error => { console.error(error instanceof Error ? error.message : error); process.exit(1) })
