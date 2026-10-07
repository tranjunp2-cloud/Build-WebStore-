import { sql } from 'drizzle-orm';
import type { Payload } from 'payload';
import { F42CatalogScopeError } from './f42-source-contract';

export type WebsiteCatalogBinding = { sourceInstance: string; targetInstance: string };

/** No latest-batch heuristic: different source/target namespaces cannot share IDs. */
export async function readWebsiteCatalogScope(payload: Payload): Promise<WebsiteCatalogBinding | undefined> {
  const db = payload.db.drizzle;
  const result = await db.execute(sql`
    SELECT DISTINCT binding->>'sourceInstance' AS "sourceInstance", binding->>'targetHash' AS "targetInstance",
      jsonb_typeof(binding->'sourceInstance') AS "sourceType", jsonb_typeof(binding->'targetHash') AS "targetType"
    FROM migration_import_batches
    WHERE profile_version IN ('pw1-json-v1','pw1-json-v2','pw1-json-v3')
  `) as { rows: Array<WebsiteCatalogBinding & { sourceType: string; targetType: string }> };
  if (result.rows.length > 1) throw new F42CatalogScopeError('AMBIGUOUS_BINDING');
  const candidate = result.rows[0];
  if (candidate && (candidate.sourceType !== 'string' || candidate.targetType !== 'string'
    || !candidate.sourceInstance?.trim() || !candidate.targetInstance?.trim())) throw new F42CatalogScopeError('INVALID_BINDING');
  const invalid = await db.execute(sql`
    SELECT EXISTS (
      SELECT 1 FROM pw1_migration_stores m
      LEFT JOIN sites s ON s.id=m.site_id AND s.tenant_id=m.tenant_id
      LEFT JOIN tenants t ON t.id=m.tenant_id
      WHERE (m.site_id IS NOT NULL AND s.id IS NULL) OR (m.tenant_id IS NOT NULL AND t.id IS NULL)
        OR (m.status='completed' AND (s.id IS NULL OR t.id IS NULL))
        OR m.status IS NULL OR m.status NOT IN ('pending','running','completed','failed')
        OR m.source_store_id !~ '^[1-9][0-9]{0,19}$'
    ) OR EXISTS (
      SELECT 1 FROM migration_import_batches b
      WHERE b.profile_version IN ('pw1-json-v1','pw1-json-v2','pw1-json-v3')
        AND jsonb_typeof(b.selected_store_ids) IS DISTINCT FROM 'array'
    ) OR EXISTS (
      SELECT 1 FROM migration_import_batches b
      CROSS JOIN LATERAL jsonb_array_elements(CASE WHEN jsonb_typeof(b.selected_store_ids)='array' THEN b.selected_store_ids ELSE '[]'::jsonb END) selected(value)
      WHERE b.profile_version IN ('pw1-json-v1','pw1-json-v2','pw1-json-v3')
        AND (jsonb_typeof(selected.value)<>'string' OR (selected.value#>>'{}') !~ '^[1-9][0-9]{0,19}$')
    ) OR EXISTS (
      SELECT 1 FROM migration_runs r JOIN migration_import_batches b ON b.batch_id=r.batch_id
      LEFT JOIN migration_import_stores i ON i.run_id=r.run_id
      WHERE b.profile_version IN ('pw1-json-v1','pw1-json-v2','pw1-json-v3') AND (
        r.source_system<>'pw1' OR r.source_instance_id IS DISTINCT FROM b.binding->>'sourceInstance'
        OR r.target_instance_id IS DISTINCT FROM b.binding->>'targetHash'
        OR i.batch_id IS DISTINCT FROM b.batch_id OR i.source_store_id IS DISTINCT FROM r.source_store_id
        OR NOT (b.selected_store_ids ? r.source_store_id))
    ) OR EXISTS (
      SELECT 1 FROM migration_entity_map e JOIN migration_runs r ON r.run_id=e.run_id
      JOIN pw1_migration_stores m ON m.source_store_id=e.source_id
      WHERE e.claim_active=true AND e.source_system='pw1' AND e.source_entity='sites'
        AND e.target_collection='sites' AND e.state IN ('CREATED','VERIFIED','SKIPPED')
        AND r.source_instance_id=${candidate?.sourceInstance ?? null}
        AND r.target_instance_id=${candidate?.targetInstance ?? null}
        AND (e.source_instance_id IS DISTINCT FROM r.source_instance_id OR e.target_id IS DISTINCT FROM m.site_id::text)
    ) AS invalid
  `) as { rows: Array<{ invalid: boolean }> };
  if (invalid.rows[0]?.invalid) throw new F42CatalogScopeError('INVALID_CATALOG');
  if (candidate) {
    // A matching ID alone does not bind the namespace-free legacy ledger.
    // For VERIFIED_REUSE the original active owner remains authoritative;
    // the later inactive SKIP row never establishes ownership by itself.
    const provenance = await db.execute(sql`
      SELECT EXISTS (
        SELECT 1 FROM pw1_migration_stores m
        WHERE NOT EXISTS (
          SELECT 1 FROM migration_entity_map e JOIN migration_runs r ON r.run_id=e.run_id
          WHERE e.source_system='pw1' AND r.source_system='pw1'
            AND e.source_instance_id=${candidate.sourceInstance} AND r.source_instance_id=${candidate.sourceInstance}
            AND r.target_instance_id=${candidate.targetInstance} AND r.source_store_id=m.source_store_id
            AND e.source_entity='sites' AND e.source_id=m.source_store_id AND e.target_collection='sites'
            AND e.target_id=m.site_id::text AND e.claim_active=true AND e.state IN ('CREATED','VERIFIED','SKIPPED')
        ) OR NOT EXISTS (
          SELECT 1 FROM migration_entity_map e JOIN migration_runs r ON r.run_id=e.run_id
          WHERE e.source_system='pw1' AND r.source_system='pw1'
            AND e.source_instance_id=${candidate.sourceInstance} AND r.source_instance_id=${candidate.sourceInstance}
            AND r.target_instance_id=${candidate.targetInstance} AND r.source_store_id=m.source_store_id
            AND e.source_entity='stores' AND e.source_id=m.source_store_id AND e.target_collection='tenants'
            AND e.target_id=m.tenant_id::text AND e.claim_active=true AND e.state IN ('CREATED','VERIFIED','SKIPPED')
        )
      ) AS unproven
    `) as { rows: Array<{ unproven: boolean }> };
    if (provenance.rows[0]?.unproven) throw new F42CatalogScopeError('UNPROVEN_LEGACY_IDENTITY');
  }
  return candidate ? { sourceInstance: candidate.sourceInstance, targetInstance: candidate.targetInstance } : undefined;
}

export function websiteCatalogSources(scope: WebsiteCatalogBinding | undefined) {
  return sql`SELECT source_store_id,updated_at FROM pw1_migration_stores
    UNION ALL
    SELECT selected.store_id AS source_store_id,b.created_at AS updated_at
    FROM migration_import_batches b CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN jsonb_typeof(b.selected_store_ids)='array' THEN b.selected_store_ids ELSE '[]'::jsonb END) selected(store_id)
    WHERE b.profile_version IN ('pw1-json-v1','pw1-json-v2','pw1-json-v3')
      AND b.binding->>'sourceInstance'=${scope?.sourceInstance ?? null}
      AND b.binding->>'targetHash'=${scope?.targetInstance ?? null}`;
}
