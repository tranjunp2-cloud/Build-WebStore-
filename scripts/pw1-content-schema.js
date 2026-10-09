/** Reviewed PW1 v2 backend schema delta. No record rewrite or unknown-index cleanup. */
const TABLES = ['products', 'blogs', 'blog_categories'];
const INDEX_SQL = `SELECT idx.relname AS name, i.indisunique AS unique, i.indisvalid AS valid,
 i.indisready AS ready, i.indimmediate AS immediate, i.indpred IS NULL AS unfiltered, i.indexprs IS NULL AS plain,
 i.indnatts=i.indnkeyatts AS no_include, am.amname AS method,
 ARRAY(SELECT a.attname::text FROM unnest(i.indkey) WITH ORDINALITY k(n,o)
 JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.n WHERE k.o<=i.indnkeyatts ORDER BY k.o) AS keys,
 NOT EXISTS(SELECT 1 FROM unnest(i.indclass) op(oid) JOIN pg_opclass c ON c.oid=op.oid WHERE NOT c.opcdefault) AS default_ops,
 NOT EXISTS(SELECT 1 FROM unnest(i.indoption) x(v) WHERE x.v<>0) AS default_order,
 NOT EXISTS(SELECT 1 FROM unnest(i.indcollation) WITH ORDINALITY c(oid,o)
 JOIN unnest(i.indkey) WITH ORDINALITY k(n,o) USING(o)
 JOIN pg_attribute a ON a.attrelid=i.indrelid AND a.attnum=k.n WHERE c.oid<>a.attcollation) AS default_collation,
 (SELECT c.conname FROM pg_constraint c WHERE c.conindid=i.indexrelid AND c.contype='u') AS constraint_name,
 EXISTS(SELECT 1 FROM pg_constraint c WHERE c.conindid=i.indexrelid AND c.contype='f') AS referenced,
 EXISTS(SELECT 1 FROM pg_attribute a WHERE a.attrelid=i.indrelid AND a.attname='slug'
 AND (a.attnum=ANY(i.indkey) OR EXISTS(SELECT 1 FROM pg_depend d WHERE d.objid=i.indexrelid AND d.refobjid=i.indrelid AND d.refobjsubid=a.attnum))) AS uses_slug
 FROM pg_index i JOIN pg_class idx ON idx.oid=i.indexrelid JOIN pg_am am ON am.oid=idx.relam
 WHERE i.indrelid=$1::regclass`;
const shape = row => row.unique && row.valid && row.ready && row.immediate && row.unfiltered && row.plain && row.no_include && row.method === 'btree' && row.default_ops && row.default_order && row.default_collation;
const keysEqual = (row, keys) => JSON.stringify(row.keys) === JSON.stringify(keys);
async function inspect(db, table) { return (await db.query(INDEX_SQL, [`public.${table}`])).rows; }
async function assertIndexes(db, table) {
 const indexes = await inspect(db, table);
 if (!indexes.some(row => row.name === `${table}_tenant_slug_uniq` && shape(row) && keysEqual(row, ['tenant_id','slug']))) throw new Error('CONTENT_TENANT_SLUG_INDEX_INVALID');
 if (indexes.some(row => row.unique && row.uses_slug && !(shape(row) && keysEqual(row, ['tenant_id','slug'])))) throw new Error('CONTENT_SLUG_CONSTRAINT_UNREVIEWED');
}
async function assertTargetContentSchema(db) {
 for (const table of TABLES) await assertIndexes(db, table);
 const result = await db.query(`SELECT table_name,column_name,data_type,character_maximum_length,is_nullable
 FROM information_schema.columns WHERE table_schema='public' AND
 ((table_name='products' AND column_name='short_description') OR (table_name='orders_items' AND column_name='product_id'))`);
 const description = result.rows.find(row => row.table_name === 'products');
 const product = result.rows.find(row => row.table_name === 'orders_items');
 if (!description || !['text','character varying'].includes(description.data_type) || description.character_maximum_length !== null) throw new Error('PRODUCT_DESCRIPTION_SCHEMA_INVALID');
 if (!product || product.data_type !== 'integer' || product.is_nullable !== 'YES') throw new Error('ORDER_HISTORY_PRODUCT_SCHEMA_INVALID');
}
async function runContentSlugTenantMigration(pool) {
 const client = await pool.connect();
 try {
  await client.query('BEGIN');
  await client.query("SET LOCAL lock_timeout='5s'");
  await client.query("SET LOCAL statement_timeout='120s'");
  await client.query('LOCK TABLE public.products,public.blogs,public.blog_categories,public.orders_items IN ACCESS EXCLUSIVE MODE');
  // All sources checked before any structural change; transaction protects the whole delta.
  for (const table of TABLES) {
   const conflict = await client.query(`SELECT 1 FROM public.${table} WHERE tenant_id IS NULL OR slug IS NULL
    UNION ALL SELECT 1 FROM public.${table} GROUP BY tenant_id,slug HAVING count(*)>1 LIMIT 1`);
   if (conflict.rows.length) throw new Error('CONTENT_TENANT_SLUG_DATA_CONFLICT');
   const indexes = await inspect(client, table);
   for (const row of indexes.filter(row => row.unique && row.uses_slug)) {
    if (shape(row) && keysEqual(row,['tenant_id','slug'])) continue;
    const approvedNames = [`${table}_slug_idx`,`${table}_slug_key`];
    if (!shape(row) || !keysEqual(row,['slug']) || !approvedNames.includes(row.name) || (row.constraint_name && !approvedNames.includes(row.constraint_name)) || row.referenced) throw new Error('CONTENT_SLUG_CONSTRAINT_UNREVIEWED');
   }
  }
  for (const table of TABLES) {
   const name = `${table}_tenant_slug_uniq`;
   await client.query(`CREATE UNIQUE INDEX IF NOT EXISTS ${name} ON public.${table}(tenant_id,slug)`);
   const indexes = await inspect(client,table);
   if (!indexes.some(row => row.name===name && shape(row) && keysEqual(row,['tenant_id','slug']))) throw new Error('CONTENT_TENANT_SLUG_INDEX_INVALID');
   for (const row of indexes.filter(row => row.unique && keysEqual(row,['slug']))) {
    // Names were allowlisted under the same table locks above; no CASCADE and no unknown drops.
    const identifier = row.constraint_name || row.name;
    if (![`${table}_slug_idx`,`${table}_slug_key`].includes(identifier)) throw new Error('CONTENT_SLUG_CONSTRAINT_UNREVIEWED');
    await client.query(row.constraint_name ? `ALTER TABLE public.${table} DROP CONSTRAINT "${identifier}"` : `DROP INDEX public."${identifier}"`);
   }
  }
  await client.query('ALTER TABLE public.products ADD COLUMN IF NOT EXISTS short_description varchar');
  await client.query('ALTER TABLE public.products ALTER COLUMN short_description TYPE varchar');
  await client.query('ALTER TABLE public.orders_items ALTER COLUMN product_id DROP NOT NULL');
  await assertTargetContentSchema(client);
  await client.query('COMMIT');
 } catch(error) { await client.query('ROLLBACK'); throw error; }
 finally { client.release(); }
}
module.exports = {runContentSlugTenantMigration,assertTargetContentSchema};
