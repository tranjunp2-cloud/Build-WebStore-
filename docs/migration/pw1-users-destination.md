# User foundation import → master destination

## Contract

`migrate:pw1:users` imports/reuses Tenant, User and Site for selected Stores. After the selected scope has been verified, produce a **new master JSON** with the same root array, all original Stores and collections (including Pages), and a sibling property on each successfully verified selected Store:

```json
"destination": { "tenantId": 425, "siteId": 424, "productCategories": [] }
```

IDs come from verified target results, never from guessed source IDs. Categories are not imported by this command. Unselected Stores are unchanged. Dry-run publishes no destination master. The source master and exporter/import manifests remain byte-for-byte unchanged so existing hashes and resume bindings stay valid. The derived master is a handoff output, not a replacement artifact accepted by the existing importer.

## CLI and publication

Add `--output-master /absolute/private/master-with-destination.json`; default to `master-with-destination.json` beside the prepared import manifest. Output must be outside Git and must not already exist. Validate output location before DB writes. Existing `--output-file` remains the optional user report, defaults beside the manifest, not in source.

Read source incrementally with strict JSON validation and bounded per-Store buffering. Retain every source field; only add destination. Verify source SHA-256 while reading. Write private temporary output in the destination directory, fsync, publish atomically without overwriting an existing file, and remove temporary files on failure. JSON whitespace may change; values and array order must not.

Exporter 1.10.0 split-master artifacts use the same CLI. For this layout, the output-master path contains a `pw1-destination-parts-v1` index instead of a root array; annotated Store arrays are written under `<output-master>.parts/`. Each part remains below 200,000,000 bytes and at most 300 Stores. Keep the index and parts directory together. Validate all input part hashes/order and publish the index last; failure before publication removes the new parts directory.

Only publish after all selected Stores verify. Any Store failure returns nonzero; no partial master is published. Committed DB operations are not rolled back by a file-output failure. The current users CLI has no resume flag; recovery of partial writes needs reconciliation and must not be represented as full success. Ledger VERIFIED in this command means foundation scope only, not full business migration.

## Implementation order

1. Document contract and approved automated cases before source edits.
2. Add bounded master writer with integrity, private-path and no-overwrite guards.
3. Wire verified destinations into users runner; fix missing child-run registration, fenced verification, target schema guard and failure exit handling required for this flow.
4. The temporary users command loads only the prepared master, manifest provenance, user actors, creator bindings and credentials. It does not certify source-report coverage or business reconciliation. Stream and hash the entire master, retain only Tenant/User/Site, then enforce target schema, required references, credentials, uniqueness and projection verification before writing. Full import retains all report/reconciliation gates.
5. Test value preservation, selected/unselected Stores, hash mismatch, invalid IDs, duplicate/missing Store, existing output, dry-run flags and atomic failure behavior. Run related regression/typecheck. Do not apply to real DB as part of implementation.

## Acceptance / verification status

Implemented filesystem publication and users-runner wiring. Targeted filesystem/CLI/flow tests pass (DB mocked for flow tests). Foundation batch binding is marked separately and cannot be resumed by the full-business runner. Users runner processes one Store at a time; no claim of 100-Store foundation preflight is made.

If output fails after DB verification, committed records remain in DB. Both JSON outputs are individually protected from overwrite; a user-report failure after master publication may leave a valid destination master. Inspect output/ledger before retry, use new output paths, and reconcile partial runs. No automated users resume is provided.

Production-size memory measurement and interrupted-write recovery remain separate acceptance steps. Local apply was verified on 2026-09-23 using a 747 MB master: one Store created Tenant/User/Site, ledger VERIFIED, credential hash/salt/key_string present, all 2,799 original Store contents preserved, exactly one destination added, source hash unchanged and output mode 0600. This does not certify a 3 GB run or automated recovery.

## Temporary scope and legacy reuse

The foundation loader does not read mapping reports, CSVs, or customer/product reconciliation files. It verifies manifest bindings and hashes for consumed identity inputs and the complete master, then spools only Tenant/User/Site. This is not full business import certification. Required references outside this scope remain errors. Legacy tenant dashboard objects compare against the same default block list rendered by the application, without changing saved preferences. Existing custom settings, user email or other mapped-value changes still block reuse.

## System creator preparation

Resolve the existing PW2 system account by exact email `sso-service@primeweb.app`, never a fixed numeric ID. The operator specifies the approved PW1 actor reference; do not automatically map every external actor to the system account. Generate private binding/evidence files for that actor using the actual target ID and identity hash. Re-prepare a new artifact with this binding and the snapshot credential CSV; never edit an existing manifest/sidecar because credentials authenticate the binding hash. Missing or ambiguous system email must stop preparation.

## Missing credentials (temporary users command)

For newly created users only, when the credential record or both passwordHash/key_string are absent, generate an unreported random 256-bit password and persist keyString=null. Record passwordResetRequired=true in ledger creation evidence and the users report. This is historical import evidence, not a live reset-status field. Existing users are never reset by migration. Partial credentials, unsupported hashes, decryption errors and mismatches remain blocking. Full importer retains its strict credential policy. No passwords enter master, reports or logs. Users must set a new password through an existing recovery flow; the authenticated SSO reset endpoint also populates keyString. No reset email is sent during import.

Local verification 2026-09-23: Store 31 applied and published successfully. Source user 64 retained verified credentials; source user 87 created with password hash, keyString=null and passwordResetRequired=true in both ledger and report. Both VERIFIED. Reset/SSO endpoint was inspected but no email or real password-reset request was executed.

User email is lowercased and trimmed in the target projection before unique checks, checksumming, writes and verification, matching Payload authentication behavior. An accepted owner/email contract with enabled `preserveInvalidUserEmails` preserves an invalid source email exactly through the migration-only writer; canonical case/whitespace uniqueness checks still apply. This does not make that address deliverable or bypass application login validation. The master source remains unchanged. Existing batches are not automatically rebound to changed importer code.
