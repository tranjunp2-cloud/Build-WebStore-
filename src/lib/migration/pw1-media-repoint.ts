type Query = <T = Record<string, unknown>>(text: string, params?: unknown[]) => Promise<{ rows: T[]; rowCount: number | null }>

const quote = (identifier: string) => `"${identifier.replace(/"/g, '""')}"`

/** Every single-column foreign key into media(id): block image fields, relationship tables, drafts. */
async function mediaForeignKeys(query: Query) {
    const { rows } = await query<{ tbl: string; col: string }>(
        `SELECT c.conrelid::regclass::text AS tbl, a.attname AS col FROM pg_constraint c
         JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = c.conkey[1]
         WHERE c.contype = 'f' AND c.confrelid = 'media'::regclass AND array_length(c.conkey, 1) = 1`)
    return rows
}

/** The json columns that may hold a copied media URL (slides, footer logo…). */
async function mediaJsonColumns(query: Query) {
    const { rows } = await query<{ table_name: string; column_name: string; data_type: string }>(
        `SELECT table_name, column_name, data_type FROM information_schema.columns
         WHERE table_schema = 'public' AND data_type IN ('json', 'jsonb')
           AND (table_name LIKE 'pages\\_blocks%' OR table_name LIKE '\\_pages\\_v\\_blocks%' OR table_name = 'sites')`)
    return rows
}

/**
 * Points everything that referenced one media row at another: every foreign key into media(id) (block image fields,
 * relationship tables, drafts) and the copied media URLs inside json columns (slides, footer logo…).
 * Only the old media of one source image is touched, so nothing else changes. Returns the number of rows updated.
 */
export async function repointMedia(query: Query, from: { id: number; url?: string | null }, to: { id: number; url?: string | null }): Promise<number> {
    let updated = 0
    for (const { tbl, col } of await mediaForeignKeys(query)) {
        // regclass::text already quotes names that need it
        const result = await query(`UPDATE ${tbl} SET ${quote(col)} = $1 WHERE ${quote(col)} = $2`, [to.id, from.id])
        updated += result.rowCount ?? 0
    }
    if (from.url && to.url && from.url !== to.url) {
        for (const { table_name, column_name, data_type } of await mediaJsonColumns(query)) {
            const col = quote(column_name)
            const result = await query(
                `UPDATE ${quote(table_name)} SET ${col} = replace(${col}::text, $1, $2)::${data_type} WHERE ${col}::text LIKE '%' || $1 || '%'`, [from.url, to.url])
            updated += result.rowCount ?? 0
        }
    }
    return updated
}

/**
 * Whether anything repointMedia would update still uses this media row. A placeholder already repointed by an
 * earlier run is no longer used, so a rerun skips it instead of downloading the source image again.
 */
export async function isMediaReferenced(query: Query, media: { id: number; url?: string | null }): Promise<boolean> {
    for (const { tbl, col } of await mediaForeignKeys(query)) {
        const { rows } = await query(`SELECT 1 FROM ${tbl} WHERE ${quote(col)} = $1 LIMIT 1`, [media.id])
        if (rows.length) return true
    }
    if (!media.url) return false
    for (const { table_name, column_name } of await mediaJsonColumns(query)) {
        const col = quote(column_name)
        const { rows } = await query(`SELECT 1 FROM ${quote(table_name)} WHERE ${col}::text LIKE '%' || $1 || '%' LIMIT 1`, [media.url])
        if (rows.length) return true
    }
    return false
}
