# Exporter → importer readiness — 2026-09-17

Conclusion: ready for integration/preflight work, NOT ready for real-data apply using the current importer. Read-only investigation; no source/artifact/DB mutation. Exporter code is largely uncommitted in worktree-2; inspect working tree, not HEAD alone.

## Actual artifact verified

Durable archive: worktree-2 `.migration/exports/pw1-prod-20260917-followup-001.tar.gz`, 168006118 bytes. Independently streamed SHA256 matches `71dea1b98fe28298dfe6aa6adb906a23320407514f63bae8a421c922b945dbae`; all seven artifact-file hashes inside archive match the actual publication manifest. Existing temporary working directory `/dev/shm/pw1-followup-review/pw1-prod-20260917-followup-001` remains available, but is not the durable handoff location.

Master1061192036bytes (~1.06GB decimal); report JSON641772688bytes; report CSV885735832bytes. Full uncompressed artifact ~2.60GB. Source2918Stores =2799emitted+118blocked+1deferred. Status needs_review/importReady=false. This flag is intentional; integrity does not certify mapping/apply readiness.

Executed current `inspectExportArtifact` against real artifact: **EXPORT_MANIFEST_INVALID**. No DB connection/write used for this test.

## Concrete compatibility gaps

1. Contract: exporter `8aacb261...bfeae9`, importer pinned `62cd5561...9d26`. Importer strict manifest also lacks `migrationPolicy` and `user-actors.json`; diagnostic schema lacks optional `reason`. Do not merely replace the hash or edit artifact.
2. Diagnostics: independent streaming count121859, including94929blockers and26930warnings;32150 have reason,63global. Importer retains at most100000 diagnostics, including generated unresolved-row diagnostics. It must aggregate/filter safely rather than just increase unbounded RAM. Accepted policy warnings need evidence-based disposition; current generic warning-as-blocker policy rejects legitimate approved decisions. Page exclusion does not remove Product/Blog content blockers.
3. Creator: every2799emittedStore has TARGET_USER_CREATOR_BINDING_REQUIRED. Importer currently permits only same-Store references; no reader/binding for global actor sidecar. Exporter creator-binding-plan is pure preflight, not target provisioning/binding. Resolve actual target User identity/provenance; never assume sourceID=targetID, match by email alone, invent memberships, or omit createdBy.
4. Destination schema drift: worktree-2 changes Product/Blog/BlogCategory slug uniqueness to tenant+slug; Product image limit>5 and shortDescription>300 preserved; historical Order.items.product optional. Current importer branch still uses old collection constraints. Selectively integrate backend collection changes + matching SQL, retain importer transaction req fixes, migrate/verify disposable clone. Do not import frontend/Page changes for this task.
5. Real source remains partially unresolved: no emittedStore has zero blocker diagnostics. Non-Page examples include Product/Blog content fidelity, missing current price, same-tenant Blog collisions, ambiguous Order status/refund, negative totals and address conflicts. Do not bypass globally or silently drop required records.

## Local prerequisites actually checked

- Existing rehearsal clone `pw1_import_1886_20260916095934` reachable localhost5433; JSON batch and shared legacy ledger tables present. It contains previous synthetic experiments: use a fresh disposable clone of the existing DB for real-source acceptance.
- Loaded local environment has DATABASE_URI, PAYLOAD_SECRET, SSO_ENCRYPTION_KEY. PW1_APP_KEY and PW2_MIGRATION_SECRET absent. Presence alone does not verify correct key values. Keep target SSO key unchanged.
- Selected Users CSV exists under `<source-export-directory>/DB_PROD`; streamed hash matches users inventory in this artifact. Current file permissions are not private enough for prepare. Copy exact bytes to a private directory/file0700/0600 rather than modifying source CSV. Do not put keys/passwords in chat or command arguments.
- Snapshot differs from earlier sample: real followup Store205 and285 each contains Tenant1/User1/Site1/PlanSubscription1, no Product/Order/Media. Both have creator-binding blocker. They can become foundation smoke candidates, not business coverage proof.

## Required sequence

1. Freeze durable artifact and approved source policy; extract/copy to a new private directory outside Git. Keep whole publication set, including creator sidecar. Budget copied artifact ~2.60GB plus temp spool minimum2×master+64MiB (~2.19GB), DB clone and margin; actual prepare disk gate is more conservative. For a future3GB master recalculate from actual sizes.
2. Update importer to this reviewed contract, actor identity binding, approved diagnostic dispositions and resource-bounded aggregation. Add regression fixtures from new exporter contract; no weakening hashes/checks.
3. Integrate required collection/SQL changes selectively, create fresh DB clone, verify schema/unique constraints, legacy source namespace and target baseline. Keep app/cron/outbound disconnected.
4. Supply private keys and same-snapshot full Users CSV; prepare encrypted sidecar with current snapshot binding. Verify recovery/hash before User writes.
5. Start with one foundation Store after creator resolution; real dry-run must pass before apply. Stop on existing plan/lifecycle/publish/identity conflicts; no source-wins default.
6. Choose a richer Store only after its non-Page diagnostics are resolved; verify Product/Order/media/arrays/credentials and outside-scope records. Re-run same batch/new batch, fault/resume; then small list/range. No --all until selected scope readiness is proven.

Commands in docs/migration/pw1-local-json-import.md remain the operational shape, but current prepare/import cannot consume this new artifact before steps2–3. Existing synthetic63tests and3GiB parser benchmark are not real-artifact acceptance.
