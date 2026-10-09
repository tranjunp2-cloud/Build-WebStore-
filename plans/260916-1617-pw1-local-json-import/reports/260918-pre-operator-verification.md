# Pre-operator local migration verification — 2026-09-18

## Confirmed

- Selected regression suite: 272 tests / 19 files PASS; typecheck PASS.
- Local primeweb schema: assertWritableProfile + assertTargetSchema PASS using read-only runtime.
- Actual Store636 remains VERIFIED; tenant1282 contains307Products; primeweb still has exactly1import batch after read-only checks.
- Actual PW1User1307 / PW2User1354: recovered source password matches stored Payload PBKDF hash; target key_string decrypts to the same password; app Docker and local importer SSO_ENCRYPTION_KEY match. Only booleans were logged.
- Browser test on localhost:3005 PASS: total307, page31 has7rows, search outside initial100 works, empty search results and clearing query work. Short-lived signed local test session; does not certify login/OTP.
- Fresh synthetic rehearsal on existing disposable clone pw1_import_1886_v3_20260917 PASS:2Stores/18entities, read-only dry-run, deliberate SIGINT after first Store, resume, cross-run reuse with zero creates, credentials/money/history/relations checks, unchanged external actor. Intentional target edit is blocked by TARGET_PROJECTION_CONFLICT.
- Synthetic evidence: /tmp/pw1-cli-rehearsal-1789700754598; interrupted/resumed batch json:5d024e18-b1c9-421b-88fb-f1768236353f, reuse batch json:ae2ae915-3140-42c3-9941-0c5dcee0b6be. Synthetic writes never targeted primeweb.

## Actual artifact scope

Prepared artifact: $PW1_ROOT/local-20260917/prepared-v3-local/import-manifest.json. No artifact bytes or hashes modified.

CLI dry-run --stores205,636 verifies the full artifact. Store205 reports STORE_PREFLIGHT_PASSED, creates4/reuses0. Store636 stops the overall command with exit3 TARGET_PROJECTION_CONFLICT; no batch or business write. Tenant1282 still stores object dashboard preferences, while current target projection normalizes non-array preferences to a block list. App runtime handles the existing object safely without changing DB. Do not silently edit ledger or overwrite existing target to bypass this guard.

Code fingerprint no longer matches the completed Store636 batch because subsequent dashboard/importer/product-list fixes changed src. Resume under this new code is intentionally incompatible; no need to resume already-VERIFIED Store636. Future batches must keep code, schema, keys, artifact and bindings unchanged until finished.

Full-master creator inventory:2799Stores;40Stores require external @users:users:1 not covered by current creator-bindings-local-51.json. Existing approved mapping is only PW1User51→PW2systemUser7. User1 must be identified and mapped authoritatively; do not infer that it is also systemUser7.

## Disk

Initial actual dry-run was correctly blocked by ARTIFACT_DISK_SPACE_INSUFFICIENT at about483MiB free. A later check showed5.8GiB free, and actual artifact dry-run proceeded. Current master requires2189492936freebytes for spool (2×master size +64MiB), in addition to storage already occupied by artifact. A future3GBmaster requires roughly6GBfree for spool alone; allow extra DB/WAL/headroom. Do not disable the disk guard. Do not regenerate another prepared copy unnecessarily.

## Operator commands

From repository root, using local .env.local (do not source clone.env), start with a new/unimported Store and require PREFLIGHT_PASSED/exit0 before removing --dry-run:

```bash
npm run migrate:pw1:import -- \
  --manifest $PW1_ROOT/local-20260917/prepared-v3-local/import-manifest.json \
  --store 205 --local-database primeweb --dry-run
```

Replace selector with --stores ID1,ID2 or --from-store START --to-store END only after that exact selection passes dry-run. Store IDs are source PW1 IDs, not target tenant IDs. All selected Stores are preflighted before any writes; one blocker prevents the whole selection from applying. --all currently cannot be approved from single-store/synthetic evidence.

After a future interrupted batch, reuse its returned runId and exactly the same code/artifact/schema/keys:

```bash
npm run migrate:pw1:import -- --resume json:UUID --local-database primeweb
```

Optional --from-store ID must not skip any unfinished Store. The cursor validates the resume boundary; previously verified Stores are still verified again. Never substitute a new source snapshot or clear claims to force resume.

## Final all-Store dry-run — NOT READY

Actual CLI `--all --local-database primeweb --dry-run` exits3 with DIAGNOSTIC_BUCKET_LIMIT. No new import batch/business writes. The diagnostic collector retains per-source identity for classified unresolved rows and is bounded at100000buckets; the entire real inventory exceeds this bound. This is an importer aggregation/scaling limitation, not proof that master hashes/mappings are corrupt. Do not merely raise/remove the cap or ignore diagnostics; aggregation must preserve the classification evidence and blocker counts while avoiding a bucket per already-resolved source row.

Final verdict: local single-store actual import has prior successful evidence, and current-code synthetic import/resume/reuse passes. Current code is NOT approved for all2799Stores. Required next work: bounded diagnostic aggregation, authoritative User1 binding for40Stores, and a selection/replay strategy that does not overwrite previously imported/changed Store636. Then rerun exact intended selection and require CLI exit0 PREFLIGHT_PASSED before apply.
