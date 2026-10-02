# F42 → F40 field evidence: local QC runbook

## F42 output for F40

The exporter writes `source-evidence.ndjson` from the selected PW1 CSV rows **before** its eligibility filters. This sidecar records a safe field value or fingerprint, row disposition, and source to target path. The JSON importer ingests that sidecar into a durable PostgreSQL source snapshot and, after each Store has a **VERIFIED child run UUID**, builds `migration_field_evidence` plus a per-run summary in `migration_evidence_generations`.

F42 persists the contract in `migration_source_evidence_snapshots`, `migration_source_evidence_rows`, `migration_evidence_generations`, and `migration_field_evidence`. The six field statuses are `match`, `mismatch`, `missing`, `duplicate`, `unsupported`, and `unverified`. F40 owns its API and Studio presentation in a separate change. The ledger supplies evidence, not a QC verdict.

The source view counts **all selected CSV rows**, including excluded/unresolved rows. Every Store-attributed row receives field evidence. Filtered/retained rows carry `source_disposition` and `unsupported/SOURCE_NOT_EMITTED`; unresolved rows carry `unverified/SOURCE_ROW_UNRESOLVED`. Neither counts as a match or a proven missing PW2 record. The summary separates per-Store source inventory by entity/disposition and reports unattributed rows, including global lookup tables. The comparison basis is the importer's verified projection at verification time. It does **not** query live PW2 state to detect later target drift.

The current read contract is `field-evidence-v26`, with `qc-fields-v1` registry hash in each generation summary. Read `migration_evidence_generations` by `(child_run_id, snapshot_id, contract_version)`, then page `migration_field_evidence` by `generation_id,source_entity,source_id,source_record_no,source_field,element_key`. Join `migration_source_evidence_snapshots` for the sidecar/manifest hash and source snapshot time. Each mapped field records the verified target projection checksum and safe normalized values where a rule supports them. Sensitive fields keep normalized values null and use keyed fingerprints. `migration_field_evidence.target_claims` contains every target identity for a `duplicate`; `target_id` is intentionally null in that case. `source_disposition` distinguishes exporter filtering from PW2 parity.

Status meaning: `match`/`mismatch` require one verified target projection and an approved normalization rule; `missing` requires a verified projection field absence or a separate target-absence proof; `duplicate` requires multiple verified target IDs; `unsupported` means the source field/row is outside the migrated target contract; `unverified` means evidence or an approved rule is insufficient. A synthetic absence proof only applies to the fixture snapshot. Do not collapse `unsupported` or `unverified` into pass.

## Read contract for F40

Use the numeric Store ID and child run UUID together. The real source view must select `exporter_sidecar`; synthetic fixture results are a separate view. F40 must apply its own authorized tenant/Super Admin check before these read-only queries.

```sql
SELECT g.generation_id,g.contract_version,g.mapping_version,g.digest,g.summary,
       g.verified_at,s.snapshot_id,s.source_snapshot_at,s.sidecar_sha256,
       s.manifest_sha256,s.provenance_kind
FROM migration_runs r
JOIN migration_evidence_generations g ON g.child_run_id=r.run_id
JOIN migration_source_evidence_snapshots s ON s.snapshot_id=g.snapshot_id
WHERE r.source_store_id=$1 AND r.run_id=$2::uuid AND r.state='VERIFIED'
  AND g.state='COMPLETE' AND g.contract_version='field-evidence-v26'
  AND s.provenance_kind=$3
ORDER BY g.completed_at DESC;

SELECT source_entity,source_id,source_record_no,source_disposition,source_field,
       element_key,target_collection,target_id,target_claims,target_field,
       comparison_status,reason_code,source_display,target_display,
       source_normalized,target_normalized,source_fingerprint,target_fingerprint,
       target_projection_checksum,transform_code,verified_at
FROM migration_field_evidence
WHERE generation_id=$1::uuid
ORDER BY source_entity,source_id,source_record_no,source_field,element_key
LIMIT $2 OFFSET $3;
```

`summary.registrySupport` is the field support matrix; `summary.sourceInventory.byEntity` and `summary.unattributedSource` are the source denominator. `summary.fieldCounts` and `summary.recordCounts` are separate and each include all six statuses. `summary.openExceptionCount` comes from the run's OPEN exception ledger. Return these values with the generation digest so F40 can show the exact evidence revision.

## Local setup and run

Use an isolated local PostgreSQL clone and a private `DATABASE_URI` for every command. `npm run dev` invokes a database migration in `predev`; check the URI before using it. Run `scripts/pw1-evidence-schema.js` through `scripts/db-setup.js --migrate-only` only against the intended clone, or let the normal application migration path create the additive tables.

The exporter must produce a validated artifact containing `source-evidence.ndjson`. When private fields need comparison, export and build use the same existing `PW2_MIGRATION_SECRET` to derive a purpose-separated evidence HMAC key. Without that secret, private comparisons remain unverified. The importer still follows its normal reviewed exclusion gate. Use the importer's child `run_id`, never its `json:<uuid>` batch ID. Normal apply/resume emits `SOURCE_EVIDENCE_INGESTED` once and `EVIDENCE_COMPLETE` per VERIFIED Store. A dry-run writes no evidence. Legacy artifacts without a sidecar emit `EVIDENCE_SKIPPED_LEGACY_ARTIFACT`; non-QC Neon imports emit `EVIDENCE_SKIPPED_NON_QC_REMOTE`.

If evidence fails after a Store becomes VERIFIED, the importer exits with an error while retaining that child. Resume the same batch to retry the idempotent evidence step. A `STORE_VERIFIED` event alone is not a complete evidence handoff.

The standalone commands below are for controlled recovery or backfill of a run imported before automatic evidence. Use the original exporter artifact: workflow finalization can seal its prepared copy. The npm equivalents are `migrate:pw1:evidence:ingest` and `migrate:pw1:evidence:build`.

```sh
node --env-file=.env --require ./scripts/seed-preload.cjs --import tsx scripts/import-pw1-evidence.ts \
  <export-artifact-directory> <local-clone-target-id>

node --env-file=.env --require ./scripts/seed-preload.cjs --import tsx scripts/build-pw1-field-evidence.ts \
  <numeric-source-store-id> <verified-child-run-uuid> \
  <source-evidence-snapshot-uuid> <source-sidecar-sha256> \
  <import-manifest.json> <local-clone-target-id>
```

Set `DATABASE_URI` to the clone and confirm `migration_target_guard.target_instance_id` equals the target ID. The builder checks the child status, manifest hash, source snapshot, mapping version, target hash, and guard. Repeating ingest/build with identical inputs reuses the completed evidence. A changed source sidecar or contract needs a new controlled generation, not an in-place edit.

On staging QC, pass `--local-database <exact-db-name> --target-host <exact-neon-host> --staging-qc-target-id <reviewed-id>` to the direct importer. For standalone recovery, append `<approved-numeric-source-store-id> <exact-neon-host>` after the target ID to the ingest command, or append `<exact-neon-host>` after the target ID to the build command. The ingest authorization checks the selected Store, while the shared source snapshot can include rows from other Stores. The database must contain a matching `migration_target_guard` and an unexpired `migration_qc_import_authorizations` row binding its target ID, target hash, database name, and allowed numeric Store IDs. The tools reject a missing or mismatched authorization and use the importer's exact-host/TLS checks. No extra staging QC environment variable is required. Keep `PW2_MIGRATION_SECRET` stable between export and build when private-field fingerprints are needed.

## Synthetic six-status fixture

For contract testing without PW1 CSV, first run the importer rehearsal on the local clone to obtain a real VERIFIED child that has Product, Category, and Order targets. The fixture adds fabricated source rows bound to that child and labels its snapshot `synthetic_fixture`. It does not prove parity with PW1. Set `DATABASE_URI` to the isolated clone; the fixture reads the target ID from its database guard.

```sh
node --env-file=.env --require ./scripts/seed-preload.cjs --import tsx scripts/seed-pw1-evidence-qc-fixture.ts \
  seed <numeric-source-store-id> <verified-child-run-uuid> <import-manifest.json>

node --env-file=.env --require ./scripts/seed-preload.cjs --import tsx scripts/seed-pw1-evidence-qc-fixture.ts \
  reset <numeric-source-store-id> <verified-child-run-uuid> <import-manifest.json>
```

Reset deletes only the synthetic snapshot bearing this child's fixture marker and its evidence generation. It refuses an unrelated generation or a non-synthetic snapshot. The fixture asserts one Product whose twelve recorded fields all match the verified projection, plus a price mismatch, SKU on-hand mismatch, confirmed missing Product, duplicate target claims, Order total/status mismatch, one OPEN exception, and a filtered Product. The fixture is **synthetic** and does not prove PW1 source coverage. Consumers must show `provenance_kind` so QC can distinguish it from exporter evidence. Do not use a shared development or staging database for the local fixture.

## Handoff and current limits

Give F40 the contract version and deployed revision, numeric Source Store ID, VERIFIED child UUID, snapshot ID and provenance, supported fields and transform rules, generation ID/digest, and a fixture owner. The tables contain summary counts, per-field reason/transform codes, safe displays or fingerprints, mapping version, snapshot hashes, and verification time. Passwords, tokens, raw credentials, and raw customer PII are excluded.

The accepted SKU stock rule compares PW1 `product_skus.stock` with PW2 `variants[].stock` or simple Product `inventory` as **on_hand**. `reserved`, `available`, and warehouse/location stay `unverified` because the source/target evidence does not establish them. The generation records exporter `sourceSnapshotAt` and importer `verified_at`; it does not assert a later live-stock value. Prices and Order amounts compare integer minor units after confirming the PW1 currency code equals PW2; sub-minor precision is rejected by the existing money normalizer, with no FX or silent rounding. Fixed Discount value uses MYR minor units; percentages use their numeric percentage.

Customer crosswalk identity, Settings Profile/Team, Email subject without the migration secret, Discount start/end timezone, Order item SKU, and refund/cancel remain explicitly `unverified` or `unsupported` according to the registry. PW2 does not store an Order item total snapshot, so `order_details.total_price` is `unsupported` with reason `PW2_ITEM_TOTAL_SNAPSHOT_NOT_STORED`; the Order grand total itself has a comparison rule. Product dimensions compare source and target centimeters; the legacy dimension-type enum is not treated as a conversion factor. Customer email uses a keyed fingerprint of the reviewed trim/lowercase normalization, never the raw address. Sidecar header version 3 and snapshot summary `sidecarVersion=3` are required for real v26 generations; this prevents an older raw-email fingerprint from being read under the new rule. Emitted Orders compare empty/null PW1 `total_tax` with PW2 zero using `ORDER_TAX_EMPTY_AS_ZERO_EQUAL` when currency matches. Domain and unsupported Payment/Delivery/Integration configuration return `unsupported`. Review `registrySupport` and `outsideScopeFields` in the summary before using totals as a migration acceptance gate. The F42 migration operator owns fixture seed/reset and must record a named owner when handing the run to QC.
