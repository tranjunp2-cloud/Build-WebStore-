export type SelectionQuery = (text: string, params: unknown[]) => Promise<{ rows: Array<Record<string, string>> }>

/**
 * Source categories whose VERIFIED mapping targets a live category in another tenant/site,
 * keyed by source id with the destination they point at (kept for the store warning).
 * PW1 template cloning copies `product_category` verbatim, so a shop can keep pointing at
 * a template-owned category; the BE import maps it correctly into the template's scope.
 * Ownership is not checked here: any out-of-scope VERIFIED mapping qualifies.
 */
export async function categoriesMappedOutsideScope(query: SelectionQuery, ids: string[], siteId: number, tenantId: number) {
    if (!ids.length) return new Map<string, string>()
    const { rows } = await query(`SELECT DISTINCT m.source_id, d.tenant_id::text AS tenant_id, d.site_id::text AS site_id FROM migration_entity_map m
        JOIN categories d ON d.id::text=m.target_id
        WHERE m.source_entity='categories' AND m.target_collection='categories' AND m.state='VERIFIED'
        AND m.source_id=ANY($1::text[]) AND (d.site_id<>$2 OR d.tenant_id<>$3) AND d.deleted_at IS NULL`, [ids, siteId, tenantId])
    return new Map(rows.map(row => [row.source_id, `tenant ${row.tenant_id} / site ${row.site_id}`]))
}

/**
 * Source products the BE export deliberately did not emit. Evidence is pinned to the
 * `exporter_sidecar` snapshot of this store's own VERIFIED import run (same source instance
 * and snapshot), so fixture snapshots, other instances and later ingests cannot change the
 * outcome. A product that is merely missing from migration_entity_map has no `retained-source`
 * row and must still fail.
 */
export async function productsNotEmittedByBe(query: SelectionQuery, sourceStoreId: string, ids: string[]) {
    if (!ids.length) return { ids: new Set<string>(), snapshotId: '' }
    const { rows } = await query(`SELECT DISTINCT r.source_id, r.snapshot_id::text AS snapshot_id FROM migration_source_evidence_rows r
        WHERE r.source_entity='products' AND r.disposition='retained-source'
        AND r.source_store_id=$1 AND r.source_id=ANY($2::text[])
        AND r.snapshot_id=(SELECT s.snapshot_id FROM migration_source_evidence_snapshots s
            JOIN migration_runs run ON run.source_instance_id=s.source_instance_id AND run.source_snapshot_id=s.source_snapshot_id
            WHERE run.source_store_id=$1 AND run.state='VERIFIED' AND s.state='COMPLETE' AND s.provenance_kind='exporter_sidecar'
            ORDER BY s.completed_at DESC NULLS LAST LIMIT 1)`, [sourceStoreId, ids])
    return { ids: new Set(rows.map(row => row.source_id)), snapshotId: rows[0]?.snapshot_id ?? '' }
}
