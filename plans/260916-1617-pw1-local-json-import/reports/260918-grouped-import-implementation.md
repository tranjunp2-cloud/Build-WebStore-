# Grouped importer + session logs — verification2026-09-18

## Implemented

- `--group-size 1..100`, default100; fixed selection boundaries and binding executionVersion=grouped-v1. Resume uses saved groupSize and rejects override/old runner batches.
- Preflight entire group before registering child runs or writing business entities; global integrity failures still block all writes.
- One parent runId; lazy child registration in fenced transaction, exact-selection completion, all-VERIFIED resume remains VERIFIED.
- Sorted disk registry from shared source key generator,4096key buffer and max2merge readers. Cross-group identity/uniqueness survives group boundaries and is rebuilt during resume.
- Lease renewal serial with bounded retry only for self-contention55P03, client query timeout10s; actual fencing loss stops future writes.
- Per-session events/errors/summary outside repository. Private0600files/0700directories, rotation32MiB, awaited writes (no background queue), atomic summary checkpoints. Raw credentials/errors/documents excluded.
- Entity receipt logged after commit; prior operation is RECONCILED, separate from new CREATE/REUSE. Log failure stops subsequent work, does not undo DB commits. Ledger is authoritative.
- Safe error output carries known run/group/store/entity metadata; durable log includes artifact hashes and at most5source-ID samples per diagnostic group.
- README updated with actual commands and known input blockers. No business schema/DB schema/env additions.

## Validation

1. `npm test -- src/__tests__/unit/migration`:274tests/16files PASS.
2. Final focused groups/runner regression after metadata/timeout changes:35tests PASS; `npm run typecheck` PASS; CLI --help PASS; diff whitespace check PASS.
3. Clone rehearsal: `/tmp/pw1-cli-rehearsal-1789707434948`, command output `/tmp/pw1-grouped-final-rehearsal.log`.
   - Three groups, dry-run unchanged counts, apply interrupted after first store, resume PASS.
   - Cross-run reuse PASS, completed-batch resume remains VERIFIED.
   - Last store of a2-store group fails preflight: zero registered children for that group/batch.
   - Group2 target conflict: only group1 registered+VERIFIED, group3 absent. Restored synthetic target then resumed successfully.
   - Independent SQL: credentials/SSO, external actor unchanged, zero stock, historical order values, six images and long description preserved.
4. Unit faults: registry collision across12000keys, same-owner replay, changed spool hash, file rotation/private permissions, secret/control-character redaction, log ENOSPC failure, dry-run planned counts, heartbeat non-overlap and retry/fencing loss.

## Real master — dry-run only

- Artifact2799stores,28groups of at most100.
- Logs: `$PW1_ROOT/logs/20260918T045521157Z-4117b05f-ec0e-4cb4-b739-b077b95978f0`.
- Reached GROUP_PREFLIGHT_STARTED group1/28; stopped GROUP_BLOCKED, exit3,5986occurrences in first group (57store IDs in summary), approximately191s including whole-artifact validation.
- No DIAGNOSTIC_BUCKET_LIMIT or SOURCE_SCOPE_MEMORY_LIMIT.
- No actual-source apply in this work. Main DB still1migration_import_batch, store636/tenant1282 still307products.
- Evidence stdout/stderr: `/tmp/pw1-grouped-full.{stdout,stderr}.log`.
- Artifact source errors remain (description/blog fidelity, media/link, catalog/variant and other mapping diagnostics). Grouping never grants permission to ignore them. No full-migration readiness claim.

## Limits

- Logs are not transactional with DB; a crash may omit the last event. Resume reconciles through ledger, never infers commit from log.
- One store above existing64MiB hydrated-store limit still blocks, regardless of groupSize. Whole-artifact guards remain intentional.
- No Vercel/remote DB support. No automatic data overwrite, source-error skip or ledger reset.
- Unit-injected disk/network failures and clone tests do not prove every OS/power-loss failure. Do not equate tests with real master successfully migrated.
- Final change after full dry-run adds artifact hashes and diagnostic sample metadata to logs; business grouping logic unchanged, focused regression/typecheck rerun.

## Follow-up review fixes — diagnostic identity and preflight context

- Durable diagnostic events now retain validated field paths and enum reasons, plus explicit samplesTruncated with at most five samples.
- Preflight forwards only store/collection/source table/source ID through a typed observer for claim, projection/credential and unique checks. Both runner preflight passes consume it; successful preflight clears entity context before later group-level failures.
- Driver errors are not wrapped or serialized; safeError still classifies connection failures for reconciliation.
- New regression tests exercise the second failing entity (projection, credential, uniqueness, connection), private event/summary output, safe metadata filtering, truncation and context cleanup.
- Verification: 286 migration tests across 17 files PASS; TypeScript check PASS. This follow-up did not import business data or alter ledger/schema/binding guards.
- Fix review caught full Entity copying at the target-check call site; runner now explicitly picks four metadata fields. A regression test invokes the real context helper with a raw-data canary and verifies both error context and subsequent group output.
