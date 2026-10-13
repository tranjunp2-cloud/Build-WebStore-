/** Synthetic comparison fixture bound to an existing VERIFIED child run. */
import { createHash, randomUUID } from 'node:crypto'
import { readFile } from 'node:fs/promises'
import { Pool } from 'pg'
import { z } from 'zod'
import { buildFieldEvidence } from '../src/lib/migration/pw1-evidence/build'
import { QC_FIELD_REGISTRY } from '../src/lib/migration/pw1-evidence/qc-field-registry'
import { assertStagingQcAuthorization } from '../src/lib/migration/pw1-json/runtime'
import { importManifestSchema } from '../src/lib/migration/pw1-json/artifact'
import type { SourceEvidenceRow } from '../src/lib/migration/pw1-export/source-evidence'

const uuid = z.string().uuid()
const storeId = z.string().regex(/^[1-9]\d*$/)
const field = (display: string, disposition = 'mapped') => ({ presence: 'value' as const, display, fingerprint: null, disposition })
const hash = (value: string | Buffer) => createHash('sha256').update(value).digest('hex')

async function main(): Promise<void> {
  const [operation, sourceStoreId, childRunId, manifestPath] = process.argv.slice(2)
  if (!['seed','reset'].includes(operation) || !manifestPath || process.argv.length !== 6) throw new Error('FIXTURE_ARGUMENTS_INVALID')
  storeId.parse(sourceStoreId)
  uuid.parse(childRunId)
  const uri = process.env.DATABASE_URI
  if (!uri) throw new Error('FIXTURE_TARGET_CONFIG_REQUIRED')
  const url = new URL(uri)
  const database = decodeURIComponent(url.pathname.slice(1))
  const local = ['localhost','127.0.0.1','[::1]'].includes(url.hostname)
  if (!['postgres:', 'postgresql:'].includes(url.protocol) || !database ||
    (local && !/^pw1_import_1886_[a-z0-9_]+$/.test(database))) throw new Error('FIXTURE_DATABASE_MISMATCH')
  const targetHash = hash(`${url.hostname}:${url.port || '5432'}/${database}/public`)
  const bytes = await readFile(manifestPath)
  const manifest = importManifestSchema.parse(JSON.parse(bytes.toString('utf8')) as unknown)
  const manifestHash = hash(bytes)
  const marker = hash(`pw1-qc-synthetic-v1:${childRunId}`)
  const pool = new Pool({ connectionString: uri, max: 2, connectionTimeoutMillis: 10000 })
  try {
    const guard = await pool.query<{ target_instance_id: string }>(
      'SELECT target_instance_id FROM migration_target_guard WHERE singleton=true',
    )
    const targetId = guard.rows[0]?.target_instance_id
    if (!targetId) throw new Error('FIXTURE_TARGET_GUARD_MISMATCH')
    if (!local) {
      await assertStagingQcAuthorization(pool, targetId, targetHash, database, [sourceStoreId])
    }
    const run = await pool.query<{ state: string; import_state: string; source_instance_id: string;
      source_snapshot_id: string; target_instance_id: string; binding: { manifestHash?: string } }>(
      `SELECT r.state,s.state AS import_state,r.source_instance_id,r.source_snapshot_id,
        r.target_instance_id,b.binding FROM migration_runs r
       JOIN migration_import_stores s ON s.run_id=r.run_id
       JOIN migration_import_batches b ON b.batch_id=s.batch_id
       WHERE r.run_id=$1 AND r.source_store_id=$2`, [childRunId,sourceStoreId],
    )
    const child = run.rows[0]
    if (!child || child.state !== 'VERIFIED' || child.import_state !== 'VERIFIED' ||
      child.target_instance_id !== targetHash || child.binding.manifestHash !== manifestHash ||
      child.source_instance_id !== manifest.sourceInstance || child.source_snapshot_id !== manifest.snapshotId) {
      throw new Error('FIXTURE_CHILD_RUN_BINDING_INVALID')
    }
    const existing = await pool.query<{ snapshot_id: string; provenance_kind: string }>(
      `SELECT snapshot_id,provenance_kind FROM migration_source_evidence_snapshots
       WHERE source_instance_id=$1 AND source_snapshot_id=$2 AND sidecar_sha256=$3`,
      [manifest.sourceInstance,manifest.snapshotId,marker],
    )
    if (operation === 'reset') {
      if (!existing.rows[0]) { process.stdout.write(JSON.stringify({ reset: true, existed: false }) + '\n'); return }
      if (existing.rows[0].provenance_kind !== 'synthetic_fixture') throw new Error('FIXTURE_MARKER_CONFLICT')
      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        const generations = await client.query<{ generation_id: string; child_run_id: string }>(
          'SELECT generation_id,child_run_id FROM migration_evidence_generations WHERE snapshot_id=$1 FOR UPDATE',
          [existing.rows[0].snapshot_id],
        )
        if (generations.rows.some(row => row.child_run_id !== childRunId)) throw new Error('FIXTURE_SHARED_GENERATION')
        await client.query(`DELETE FROM migration_field_evidence WHERE generation_id IN
          (SELECT generation_id FROM migration_evidence_generations WHERE snapshot_id=$1)`, [existing.rows[0].snapshot_id])
        await client.query('DELETE FROM migration_evidence_generations WHERE snapshot_id=$1', [existing.rows[0].snapshot_id])
        await client.query('DELETE FROM migration_target_absence_proofs WHERE snapshot_id=$1 AND proof_kind=\'synthetic_fixture\'',
          [existing.rows[0].snapshot_id])
        await client.query(`DELETE FROM migration_exceptions
          WHERE run_id=$1 AND source_entity='qc_fixture' AND source_id=$2
            AND error_code='QC_EVIDENCE_SYNTHETIC_OPEN'`, [childRunId,marker])
        await client.query('DELETE FROM migration_source_evidence_rows WHERE snapshot_id=$1', [existing.rows[0].snapshot_id])
        await client.query(`DELETE FROM migration_source_evidence_snapshots
          WHERE snapshot_id=$1 AND provenance_kind='synthetic_fixture' AND sidecar_sha256=$2`,
          [existing.rows[0].snapshot_id,marker])
        await client.query('COMMIT')
        process.stdout.write(JSON.stringify({ reset: true, existed: true }) + '\n')
      } catch (error) { await client.query('ROLLBACK'); throw error }
      finally { client.release() }
      return
    }
    if (existing.rows[0]) throw new Error('FIXTURE_ALREADY_EXISTS_RESET_FIRST')
    const maps = await pool.query<{ source_entity: string; source_id: string;
      target_collection: string; detail: { projection?: Record<string, unknown> } }>(
      `SELECT source_entity,source_id,target_collection,detail FROM migration_entity_map
       WHERE run_id=$1 AND state IN ('VERIFIED','SKIPPED')
         AND target_collection IN ('products','categories','orders','media','discounts','customers','email-template-settings')`, [childRunId],
    )
    const product = maps.rows.find(row => row.source_entity === 'products' && row.target_collection === 'products')
    const category = maps.rows.find(row => row.target_collection === 'categories')
    const order = maps.rows.find(row => row.target_collection === 'orders')
    const media = maps.rows.find(row => row.target_collection === 'media')
    const discount = maps.rows.find(row => row.target_collection === 'discounts')
    const customer = maps.rows.find(row => row.target_collection === 'customers')
    const email = maps.rows.find(row => row.target_collection === 'email-template-settings')
    if (!product?.detail.projection || !category || !order?.detail.projection || !media || !discount || !customer || !email ||
      typeof product.detail.projection.name !== 'string' ||
      typeof product.detail.projection.slug !== 'string' ||
      product.detail.projection.status !== 'draft' ||
      product.detail.projection.weight !== 0.5 ||
      !product.detail.projection.dimensions ||
      typeof product.detail.projection.dimensions !== 'object' ||
      typeof order.detail.projection.total !== 'number') {
      throw new Error('FIXTURE_COMMERCE_TARGETS_REQUIRED')
    }
    const productRef = `@products:products:${product.source_id}`
    const orderRef = `@orders:orders:${order.source_id}`
    const rows: SourceEvidenceRow[] = [
      { kind: 'row', table: 'currencies', sourceId: '1', storeId: null, record: 1,
        disposition: 'mapped', redactedFieldCount: 0, targetPaths: [],
        fields: { code: field('MYR') } },
      { kind: 'row', table: 'stores', sourceId: sourceStoreId, storeId: sourceStoreId, record: 1,
        disposition: 'mapped', redactedFieldCount: 0, targetPaths: [],
        fields: { currency_id: field('1') } },
      { kind: 'row', table: 'payment_methods', sourceId: '1', storeId: null, record: 1,
        disposition: 'mapped', redactedFieldCount: 0, targetPaths: [],
        fields: { code: field('cod') } },
      { kind: 'row', table: 'product_images', sourceId: media.source_id, storeId: sourceStoreId, record: 1,
        disposition: 'mapped', redactedFieldCount: 0,
        targetPaths: [{ path: `@media:product_images:${media.source_id}`, rule: 'synthetic-fixture', fields: ['product_id'] }],
        fields: { product_id: field(product.source_id) } },
      { kind: 'row', table: 'customers', sourceId: customer.source_id, storeId: sourceStoreId, record: 1,
        disposition: 'mapped', redactedFieldCount: 0,
        targetPaths: [{ path: `@customers:customers:${customer.source_id}`, rule: 'synthetic-fixture', fields: [] }],
        fields: {} },
      { kind: 'row', table: 'addresses', sourceId: '990001', storeId: sourceStoreId, record: 1,
        disposition: 'mapped', redactedFieldCount: 0,
        targetPaths: [{ path: `@customers:customers:${customer.source_id}.addresses.0`,
          rule: 'synthetic-fixture', fields: ['customer_id'] }],
        fields: { customer_id: field(customer.source_id) } },
      { kind: 'row', table: 'promotions', sourceId: '990001', storeId: sourceStoreId, record: 1,
        disposition: 'mapped', redactedFieldCount: 0,
        targetPaths: [{ path: `@discounts:promotion_codes:${discount.source_id}`, rule: 'synthetic-fixture',
          fields: ['discount_type_id','discount_value','status'] }],
        fields: { discount_type_id: field('2'), discount_value: field('1.00'), status: field('0') } },
      { kind: 'row', table: 'store_email_templates', sourceId: email.source_id, storeId: sourceStoreId,
        record: 1, disposition: 'mapped', redactedFieldCount: 0,
        targetPaths: [{ path: `@email-template-settings:store_email_templates:${email.source_id}`,
          rule: 'synthetic-fixture', fields: ['status'] }], fields: { status: field('0') } },
      { kind: 'row', table: 'products', sourceId: product.source_id, storeId: sourceStoreId, record: 1,
        disposition: 'mapped', redactedFieldCount: 0,
        targetPaths: [{ path: productRef, rule: 'synthetic-fixture',
          fields: ['name','slug','status','category_id','package_weight','package_length','package_width','package_height'] }],
        fields: { name: field(product.detail.projection.name),
          slug: field(product.detail.projection.slug as string), status: field('0'),
          category_id: field(category.source_id), package_weight: field('500'),
          package_weight_type: field('2'), package_length: field('12.5'),
          package_width: field('8'), package_height: field('4') } },
      { kind: 'row', table: 'products', sourceId: '999999003', storeId: sourceStoreId, record: 2,
        disposition: 'mapped', redactedFieldCount: 0,
        targetPaths: [{ path: productRef, rule: 'synthetic-fixture', fields: ['name'] },
          { path: `@categories:categories:${category.source_id}`, rule: 'synthetic-fixture', fields: ['name'] }],
        fields: { name: field(product.detail.projection.name) } },
      { kind: 'row', table: 'product_skus', sourceId: '999001', storeId: sourceStoreId, record: 1,
        disposition: 'mapped', redactedFieldCount: 0,
        targetPaths: [{ path: productRef, rule: 'synthetic-fixture', fields: ['price','stock'] }],
        fields: { price: field('10.00'), stock: field('5') } },
      { kind: 'row', table: 'product_skus', sourceId: '999002', storeId: sourceStoreId, record: 2,
        disposition: 'mapped', redactedFieldCount: 0,
        targetPaths: [{ path: productRef, rule: 'synthetic-fixture', fields: ['price'] }],
        fields: { price: field('999.00'), cost: field('8.00') } },
      { kind: 'row', table: 'product_skus', sourceId: '999003', storeId: sourceStoreId, record: 3,
        disposition: 'mapped', redactedFieldCount: 0,
        targetPaths: [{ path: `${productRef}.syntheticMissing`, rule: 'synthetic-fixture', fields: ['price'] }],
        fields: { price: field('10.00') } },
      { kind: 'row', table: 'orders', sourceId: order.source_id, storeId: sourceStoreId, record: 1,
        disposition: 'mapped', redactedFieldCount: 0,
        targetPaths: [{ path: orderRef, rule: 'synthetic-fixture',
          fields: ['currency_id','payment_method_id','purchase_status','total','status'] }],
        fields: { currency_id: field('1'), payment_method_id: field('1'),
          purchase_status: { presence: 'empty', display: '', fingerprint: null, disposition: 'mapped' },
          total: field(String(order.detail.projection.total + 1)), status: field('6') } },
      { kind: 'row', table: 'products', sourceId: '999999001', storeId: sourceStoreId, record: 3,
        disposition: 'mapped', redactedFieldCount: 0,
        targetPaths: [{ path: '@products:products:999999001', rule: 'synthetic-fixture', fields: ['name'] }],
        fields: { name: field('Synthetic missing-claim product') } },
      { kind: 'row', table: 'products', sourceId: '999999002', storeId: sourceStoreId, record: 4,
        disposition: 'excluded', redactedFieldCount: 0, targetPaths: [],
        fields: { name: field('Synthetic exporter-filtered product', 'excluded') } },
    ]
    const snapshotId = randomUUID()
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query(`INSERT INTO migration_source_evidence_snapshots
        (snapshot_id,source_instance_id,source_snapshot_id,source_snapshot_at,manifest_sha256,sidecar_sha256,
         pii_comparable,provenance_kind,state,summary,completed_at)
        VALUES($1,$2,$3,$4::timestamptz,$5,$6,false,'synthetic_fixture','COMPLETE',$7::jsonb,clock_timestamp())`,
      [snapshotId,manifest.sourceInstance,manifest.snapshotId,manifest.asOf,manifest.exporterManifestHash,marker,
        JSON.stringify({ sourceRecords: rows.length, sourceFields: rows.reduce((sum,row) => sum + Object.keys(row.fields).length,0),
          selectedTables: ['products','product_skus','orders','stores','currencies','payment_methods','product_images',
            'customers','addresses','promotions','store_email_templates'], fixture: true })])
      for (const row of rows) await client.query(`INSERT INTO migration_source_evidence_rows
        (snapshot_id,source_store_id,source_entity,source_id,record_no,disposition,target_paths,redacted_field_count,fields)
        VALUES($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9::jsonb)`, [snapshotId,row.storeId,row.table,row.sourceId,
        row.record,row.disposition,JSON.stringify(row.targetPaths),row.redactedFieldCount,JSON.stringify(row.fields)])
      await client.query(`INSERT INTO migration_target_absence_proofs
        (snapshot_id,source_store_id,source_entity,source_id,target_collection,proof_kind,read_at)
        VALUES($1,$2,'products','999999001','products','synthetic_fixture',clock_timestamp())`,
        [snapshotId,sourceStoreId])
      await client.query(`INSERT INTO migration_exceptions
        (run_id,source_entity,source_id,severity,error_code,detail,state)
        VALUES($1,'qc_fixture',$2,'WARNING','QC_EVIDENCE_SYNTHETIC_OPEN',
          '{"synthetic":true}'::jsonb,'OPEN')`, [childRunId,marker])
      await client.query('COMMIT')
    } catch (error) { await client.query('ROLLBACK'); throw error }
    finally { client.release() }
    const result = await buildFieldEvidence({ pool, sourceStoreId, childRunId,
      sourceSnapshotId: snapshotId, sourceSidecarSha256: marker, provenanceKind: 'synthetic_fixture',
      importManifestPath: manifestPath,
      expectedTargetInstanceId: targetId, expectedTargetHash: targetHash })
    const matchedProduct = await pool.query<{ source_field: string; comparison_status: string }>(
      `SELECT source_field,comparison_status FROM migration_field_evidence
       WHERE generation_id=$1 AND source_entity='products' AND source_id=$2 AND source_record_no=1`,
      [result.generationId,product.source_id],
    )
    const requiredProductFields = QC_FIELD_REGISTRY.filter(entry =>
      entry.group === 'Product' && entry.support === 'compare').map(entry => entry.key.split('.')[1])
    if (matchedProduct.rows.length !== requiredProductFields.length ||
      matchedProduct.rows.some(row => row.comparison_status !== 'match') ||
      requiredProductFields.some(name => !matchedProduct.rows.some(row => row.source_field === name))) {
      throw new Error('FIXTURE_FULL_PRODUCT_MATCH_MISSING')
    }
    const generation = await pool.query<{ summary: { fieldCounts: Record<string,number>; openExceptionCount: number } }>(
      'SELECT summary FROM migration_evidence_generations WHERE generation_id=$1', [result.generationId],
    )
    if (!generation.rows[0] || generation.rows[0].summary.openExceptionCount < 1 ||
      ['match','mismatch','missing','duplicate','unsupported','unverified'].some(status =>
        !(generation.rows[0].summary.fieldCounts[status] > 0))) throw new Error('FIXTURE_QC_CASES_INCOMPLETE')
    const cases = await pool.query<{ source_entity: string; source_id: string; source_field: string;
      comparison_status: string }>(
      `SELECT source_entity,source_id,source_field,comparison_status FROM migration_field_evidence
       WHERE generation_id=$1 AND
         ((source_entity='products' AND source_id IN ('999999001','999999003'))
           OR (source_entity='product_skus' AND source_id IN ('999001','999002'))
           OR (source_entity='orders' AND source_id=$2))`,
      [result.generationId,order.source_id],
    )
    const hasCase = (entity: string, id: string, fieldName: string, status: string) =>
      cases.rows.some(row => row.source_entity === entity && row.source_id === id &&
        row.source_field === fieldName && row.comparison_status === status)
    if (!hasCase('product_skus','999002','price','mismatch') ||
      !hasCase('product_skus','999001','stock','mismatch') ||
      !hasCase('products','999999001','name','missing') ||
      !hasCase('products','999999003','name','duplicate') ||
      !hasCase('orders',order.source_id,'total','mismatch') ||
      !hasCase('orders',order.source_id,'status','mismatch')) {
      throw new Error('FIXTURE_QC_CASES_INCOMPLETE')
    }
    process.stdout.write(JSON.stringify({ fixture: 'synthetic', sourceStoreId, childRunId,
      snapshotId, generationId: result.generationId, fieldTotal: result.fieldTotal,
      fullProductMatched: true }) + '\n')
  } finally { await pool.end() }
}

main().catch(error => {
  const code = error instanceof Error && /^[A-Z][A-Z0-9_]{2,100}$/.test(error.message) ? error.message : 'QC_FIXTURE_FAILED'
  process.stderr.write(code + '\n')
  process.exitCode = 1
})
